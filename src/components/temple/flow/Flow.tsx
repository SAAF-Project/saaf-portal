import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ALERT_COLOR, tagSeverity } from "../alerts";
import { PALETTE } from "../colors";
import { GLYPH_PATHS, KIND_LABEL } from "../glyphs";
import { DISCLAIMER } from "../relations";
import { hashString, wobblyRectPath } from "../sketch";
import { stageOf } from "../stages";
import type { VisualProps } from "../views";
import { buildGraph, chainOf } from "./graph";
import { CARD_H, CARD_W, LABEL_W, computeFlow, type Card } from "./layout";

/**
 * The dependency map: a flat diagram of which plan's output is another plan's input. One lane per part, the order of
 * the work from left to right, one card per plan in its stage colour. Click a plan to light up everything it depends
 * on and everything that depends on it.
 */

const INK = "#141c32"; // text on the stage colours, the same in both themes
const UNLINKED_KEY = "saaf-temple-unlinked";
const TITLE_FONT = '600 12.5px system-ui, "Segoe UI", Roboto, sans-serif';
const LANE_FONT = '700 15px system-ui, "Segoe UI", Roboto, sans-serif';
const PANEL_W = 392; // side panel (360) plus its margin
const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private window: the choice is just not remembered */
  }
}

// Card titles and lane names wrap onto two lines, measured with the real font; the full title is in the tooltip.
let measureCtx: CanvasRenderingContext2D | null = null;
function titleLines(text: string, width: number, font = TITLE_FONT): string[] {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const ctx = measureCtx!;
  ctx.font = font;
  const fits = (s: string) => ctx.measureText(s).width <= width;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (fits(next)) line = next;
    else if (!line) {
      line = words[i];
      break;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length === 2) break;
    }
  }
  if (lines.length < 2 && line) lines.push(line);
  const cut = lines.length === 2 ? lines.join(" ").length < text.length : i < words.length - 1;
  if (cut || !fits(lines[lines.length - 1])) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

interface ViewBox {
  x: number; // world point at the left edge of the screen
  y: number;
  s: number; // screen pixels per world unit
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
/** The same view at scale `s`, with the world point under screen point (mx, my) staying put. */
const scaleAround = (v: ViewBox, s: number, mx: number, my: number): ViewBox => ({ s, x: v.x + mx / v.s - mx / s, y: v.y + my / v.s - my / s });
// the zoom slider moves on a log scale, so every step zooms by the same factor
const SLIDER_STEPS = 100;
const toSlider = (s: number) => Math.round((Math.log(s / MIN_SCALE) / Math.log(MAX_SCALE / MIN_SCALE)) * SLIDER_STEPS);
const fromSlider = (n: number) => MIN_SCALE * Math.pow(MAX_SCALE / MIN_SCALE, n / SLIDER_STEPS);

export function Flow({ data, theme, focus, matches, filtersActive, sketch, relations, onFocus, onInfo }: VisualProps) {
  const palette = PALETTE[theme];
  const [showUnlinked, setShowUnlinked] = useState(() => readStored(UNLINKED_KEY) === "on");
  const [hover, setHover] = useState<string | null>(null);
  const plans = useMemo(() => new Map(data.plans.map((p) => [p.slug, p])), [data]);
  const selected = focus.level === "plan" || focus.level === "annex" ? focus.slug : undefined;
  const focusPart = focus.level === "part" ? focus.partId : undefined;

  const flow = useMemo(() => computeFlow(data.plans, data.parts, relations, { showUnlinked, keep: selected }), [data, relations, showUnlinked, selected]);
  const graph = useMemo(() => buildGraph(data.plans.map((p) => p.slug), relations), [data, relations]);
  const chain = useMemo(() => (selected ? chainOf(selected, graph) : null), [selected, graph]);
  const linkedCount = useMemo(() => new Set(relations.flatMap((r) => [r.from, r.to])).size, [relations]);
  const confirmed = relations.filter((r) => r.status === "confirmed").length;
  const unlinkedTotal = data.plans.length - linkedCount;

  // ---- pan and zoom -----------------------------------------------------------------------------------------------
  const hostRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [view, setView] = useState<ViewBox>({ x: 0, y: 0, s: 0.5 });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view; // handlers read the latest view without re-binding
  }, [view]);
  const anim = useRef<number | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const animateTo = useCallback((target: ViewBox, ms = 550) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    const from = viewRef.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const k = ease(t);
      setView({ x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, s: from.s + (target.s - from.s) * k });
      anim.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    anim.current = requestAnimationFrame(step);
  }, []);

  // What to frame: the selected plan's chain, the focused lane, or everything; clear of the panel, header and notice.
  const target = useMemo((): Box => {
    const around = (cards: Card[]): Box => {
      const x0 = Math.min(...cards.map((c) => c.x)), y0 = Math.min(...cards.map((c) => c.y));
      const x1 = Math.max(...cards.map((c) => c.x + c.w)), y1 = Math.max(...cards.map((c) => c.y + c.h));
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    };
    if (selected && flow.cards[selected]) {
      const cards = [...(chain ?? [selected])].map((s) => flow.cards[s]).filter((c): c is Card => !!c);
      return around(cards);
    }
    if (focusPart) {
      const lane = flow.lanes.find((l) => l.id === focusPart);
      const cards = Object.values(flow.cards).filter((c) => c.lane === focusPart);
      if (lane && cards.length) {
        const b = around(cards);
        return { x: 0, y: lane.y, w: b.x + b.w, h: lane.h };
      }
    }
    return { x: 0, y: 0, w: flow.width, h: flow.height };
  }, [selected, focusPart, flow, chain]);

  // the part of the screen the map can use: below the header and the notice, left of the panel, above the legend
  const freeArea = useCallback(() => {
    const narrow = size.w < 800;
    const top = 40 + 60 + (noticeRef.current?.offsetHeight ?? 0) + 16;
    const left = 16, right = narrow ? 16 : PANEL_W + 8;
    const bottom = narrow ? size.h * 0.42 + 64 : 70;
    return { top, left, aw: Math.max(120, size.w - left - right), ah: Math.max(120, size.h - top - bottom) };
  }, [size]);

  const fit = useCallback(
    (box: Box, animate: boolean) => {
      const { top, left, aw, ah } = freeArea();
      const pad = 40;
      const s = Math.min(MAX_SCALE * 0.6, Math.max(MIN_SCALE, Math.min(aw / (box.w + 2 * pad), ah / (box.h + 2 * pad))));
      const next = { s, x: box.x - pad - (aw - (box.w + 2 * pad) * s) / 2 / s - left / s, y: box.y - pad - (ah - (box.h + 2 * pad) * s) / 2 / s - top / s };
      if (animate) animateTo(next);
      else setView(next);
    },
    [freeArea, animateTo],
  );

  // zoom slider and buttons: zoom around the middle of the free area
  const zoomTo = (s: number, animate: boolean) => {
    const { top, left, aw, ah } = freeArea();
    const from = anim.current ? viewRef.current : view;
    const next = scaleAround(from, clampScale(s), left + aw / 2, top + ah / 2);
    if (animate) animateTo(next, 250);
    else {
      if (anim.current) cancelAnimationFrame(anim.current);
      viewRef.current = next;
      setView(next);
    }
  };

  const first = useRef(true);
  useEffect(() => {
    fit(target, !first.current);
    first.current = false;
  }, [target, fit]);

  // pointer: drag to pan, two fingers to zoom; a press that hardly moves is a click
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const pinch = useRef<{ d: number; s: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: viewRef.current.s };
    }
    if (anim.current) cancelAnimationFrame(anim.current);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    moved.current += Math.hypot(now.x - prev.x, now.y - prev.y);
    // capture only once it is a drag: capturing on press would send the click to the background instead of the card
    const el = e.currentTarget as Element;
    if (dragged() && !el.hasPointerCapture?.(e.pointerId)) el.setPointerCapture?.(e.pointerId);
    const v = viewRef.current;
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const rect = hostRef.current!.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
      setView(scaleAround(v, clampScale((pinch.current.s * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d), mx, my));
    } else if (pointers.current.size === 1) {
      setView({ ...v, x: v.x - (now.x - prev.x) / v.s, y: v.y - (now.y - prev.y) / v.s });
    }
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const dragged = () => moved.current > 4;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (anim.current) cancelAnimationFrame(anim.current);
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      // update the ref at once, so a quick series of wheel events adds up
      viewRef.current = scaleAround(viewRef.current, clampScale(viewRef.current.s * Math.exp(-e.deltaY * 0.0015)), mx, my);
      setView(viewRef.current);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ---- clicks -----------------------------------------------------------------------------------------------------
  const back = () => {
    if (dragged()) return;
    if (focus.level === "plan") {
      const plan = plans.get(focus.slug);
      onFocus(plan ? { level: "part", partId: plan.part } : { level: "project" });
    } else if (focus.level === "annex" && focus.slug) onFocus({ level: "annex" });
    else if (focus.level !== "project") onFocus({ level: "project" });
  };
  const pick = (slug: string) => {
    if (dragged()) return;
    onFocus(focus.level === "annex" && data.annex.items.some((i) => i.plan === slug) ? { level: "annex", slug } : { level: "plan", slug });
  };
  const toggleUnlinked = () => {
    setShowUnlinked(!showUnlinked);
    writeStored(UNLINKED_KEY, showUnlinked ? "off" : "on");
  };

  // ---- what stands out ----------------------------------------------------------------------------------------------
  const cardDim = (slug: string, lane: string) => {
    const plan = plans.get(slug);
    if (filtersActive && plan && !matches(plan) && slug !== selected) return true;
    if (chain) return !chain.has(slug);
    if (focusPart) return lane !== focusPart;
    return false;
  };
  const near = hover && !chain ? new Set([hover, ...relations.filter((r) => r.from === hover || r.to === hover).flatMap((r) => [r.from, r.to])]) : null;
  const arrowState = (from: string, to: string): "on" | "off" | "normal" => {
    if (chain) return chain.has(from) && chain.has(to) ? "on" : "off";
    if (near) return from === hover || to === hover ? "on" : "off";
    if (focusPart) return flow.cards[from]?.lane === focusPart || flow.cards[to]?.lane === focusPart ? "normal" : "off";
    if (filtersActive) {
      const a = plans.get(from), b = plans.get(to);
      return a && b && matches(a) && matches(b) ? "normal" : "off";
    }
    return "normal";
  };
  const showLabels = view.s >= 1.05;
  const titles = useMemo(() => new Map(data.plans.map((p) => [p.slug, titleLines(p.title || p.slug, CARD_W - 42)])), [data]);
  const laneNames = useMemo(() => new Map(flow.lanes.map((l) => [l.id, titleLines(l.label, LABEL_W - 36, LANE_FONT)])), [flow.lanes]);

  const stroke = { normal: palette.ink, on: palette.ink, off: palette.ink };
  const opacity = { normal: 0.5, on: 0.95, off: 0.08 };
  const width = { normal: 1.6, on: 2.6, off: 1.4 };

  return (
    <div className="flow" ref={hostRef} style={{ background: palette.background }}>
      <svg
        className="flow-svg"
        width={size.w}
        height={size.h}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={back}
        role="img"
        aria-label="Dependency map: which plan's output is another plan's input"
      >
        <defs>
          {(["normal", "on", "off"] as const).map((k) => (
            <marker key={k} id={`flow-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10Z" fill={stroke[k]} fillOpacity={opacity[k]} transform="scale(1)" />
            </marker>
          ))}
        </defs>
        <g transform={`scale(${view.s}) translate(${-view.x} ${-view.y})`}>
          {/* lanes */}
          {flow.lanes.map((lane, i) => (
            <g key={lane.id}>
              <rect x={0} y={lane.y} width={flow.width} height={lane.h} fill={i % 2 ? "transparent" : palette.ground} opacity={0.55} />
              {focusPart === lane.id && <rect x={1} y={lane.y + 1} width={flow.width - 2} height={lane.h - 2} fill="none" stroke={palette.ink} strokeOpacity={0.5} strokeWidth={2 / Math.max(view.s, 0.4)} rx={6} />}
              <g
                className="flow-lane-label"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!dragged()) onFocus({ level: "part", partId: lane.id });
                }}
              >
                <title>{`${lane.label}: click to focus this part`}</title>
                <text x={16} y={lane.y + lane.h / 2 - 4 - ((laneNames.get(lane.id)?.length ?? 1) - 1) * 9} fill={palette.ink} style={{ font: LANE_FONT }}>
                  {(laneNames.get(lane.id) ?? [lane.label]).map((l, i) => (
                    <tspan key={i} x={16} dy={i ? 18 : 0}>{l}</tspan>
                  ))}
                </text>
                <text x={16} y={lane.y + lane.h / 2 + 14 + ((laneNames.get(lane.id)?.length ?? 1) - 1) * 9} fill={palette.ink} fillOpacity={0.6} fontSize={11.5}>
                  {lane.shown ? `${lane.shown} plan${lane.shown === 1 ? "" : "s"}` : "no relations"}{lane.hidden ? ` · ${lane.hidden} hidden` : ""}
                </text>
              </g>
            </g>
          ))}

          {/* the line before the plans without relations */}
          {flow.unlinkedX !== null && (
            <g>
              <line x1={flow.unlinkedX} y1={0} x2={flow.unlinkedX} y2={flow.height} stroke={palette.ink} strokeOpacity={0.35} strokeDasharray="6 6" strokeWidth={1.5} />
              <text x={flow.unlinkedX + 12} y={16} fill={palette.ink} fillOpacity={0.6} fontSize={12}>No documented inputs or outputs</text>
            </g>
          )}

          {/* arrows: dashed = suggested by AI from the plan texts, solid = confirmed by an owner */}
          {flow.arrows.map((a) => {
            const st = arrowState(a.from, a.to);
            return (
              <g key={`${a.from}>${a.to}`} pointerEvents="none">
                <path d={a.d} fill="none" stroke={stroke[st]} strokeOpacity={opacity[st]} strokeWidth={width[st]} strokeDasharray={a.status === "suggested" ? "7 5" : undefined} markerEnd={`url(#flow-arrow-${st})`} />
                {sketch && st !== "off" && <path d={a.d} fill="none" stroke={stroke[st]} strokeOpacity={opacity[st] * 0.35} strokeWidth={1} transform="translate(0.8 1.1)" strokeDasharray={a.status === "suggested" ? "7 5" : undefined} />}
              </g>
            );
          })}

          {/* cards */}
          {Object.values(flow.cards).map((c) => {
            const plan = plans.get(c.slug);
            if (!plan) return null;
            const stage = stageOf(plan);
            const dim = cardDim(c.slug, c.lane);
            const on = c.slug === selected;
            const hot = c.slug === hover;
            const sev = tagSeverity(plan);
            const glyph = GLYPH_PATHS[plan.kind];
            const lines = titles.get(c.slug) ?? [];
            return (
              <g
                key={c.slug}
                className="flow-card"
                transform={`translate(${c.x} ${c.y})`}
                opacity={dim ? 0.16 : c.linked ? 1 : 0.88}
                onClick={(e) => {
                  e.stopPropagation();
                  pick(c.slug);
                }}
                onPointerEnter={() => setHover(c.slug)}
                onPointerLeave={() => setHover((h) => (h === c.slug ? null : h))}
              >
                <title>{`${plan.title || plan.slug}\n${stage.label} · ${KIND_LABEL[plan.kind].toLowerCase()}${c.linked ? "" : " · no documented inputs or outputs"}`}</title>
                <rect width={c.w} height={c.h} rx={8} fill={stage.color} stroke={on || hot ? "#ffffff" : sketch ? "none" : palette.edge} strokeWidth={on ? 3.5 : hot ? 2 : 1.2} strokeDasharray={!c.linked && !on && !hot ? "5 4" : undefined} />
                {sketch && !on && !hot && <path d={wobblyRectPath(0, 0, c.w, c.h, hashString(c.slug))} fill="none" stroke={palette.edge} strokeWidth={1.1} strokeLinecap="round" />}
                {sev && <path d="M8 0H22L0 22V8A8 8 0 0 1 8 0Z" fill={ALERT_COLOR[sev]} />}
                {glyph && <path d={glyph} fill="rgba(20, 28, 50, 0.62)" fillRule="evenodd" transform={`translate(11 ${CARD_H / 2 - 9}) scale(0.75)`} />}
                <text x={36} y={lines.length > 1 ? 25 : 34} fill={INK} fontSize={12.5} fontWeight={600} style={{ font: TITLE_FONT }}>
                  {lines.map((l, i) => (
                    <tspan key={i} x={36} dy={i ? 16 : 0}>{l}</tspan>
                  ))}
                </text>
              </g>
            );
          })}

          {/* what flows, on the arrows: for the lit chain, or everywhere when zoomed in */}
          {flow.arrows.map((a) => {
            const st = arrowState(a.from, a.to);
            if (!a.what || st === "off" || !(st === "on" || showLabels)) return null;
            const label = a.what.length > 26 ? `${a.what.slice(0, 25)}…` : a.what;
            return (
              <text key={`l-${a.from}>${a.to}`} x={a.mid[0]} y={a.mid[1] - 4} textAnchor="middle" fontSize={11} fill={palette.ink} stroke={palette.background} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" pointerEvents="none">
                {label}
              </text>
            );
          })}
        </g>
      </svg>

      <div className="flow-notice" ref={noticeRef} role="region" aria-label="About this map, and its controls">
        <b>⚠ {DISCLAIMER.title}</b>
        <p>{DISCLAIMER.text}</p>
        <div className="flow-notice-row">
          <span>
            {relations.length} relations, <b>{confirmed}</b> confirmed by an owner
          </span>
          <button className="linkish" onClick={() => onInfo("relations")}>How were these made?</button>
        </div>
        <div className="flow-notice-row">
          <label className="flow-toggle">
            <input type="checkbox" checked={showUnlinked} onChange={toggleUnlinked} />
            Show plans without relations ({unlinkedTotal})
          </label>
          <span className="flow-key" aria-label="Line styles">
            <svg width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" /></svg> suggested
            <svg width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" stroke="currentColor" strokeWidth="2" /></svg> confirmed
          </span>
        </div>
        <div className="flow-zoom" role="group" aria-label="Zoom">
          <button onClick={() => zoomTo(view.s / 1.25, true)} aria-label="Zoom out" title="Zoom out">−</button>
          <input
            type="range"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={toSlider(view.s)}
            onChange={(e) => zoomTo(fromSlider(Number(e.target.value)), false)}
            aria-label="Zoom level"
            aria-valuetext={`${Math.round(view.s * 100)}%`}
          />
          <button onClick={() => zoomTo(view.s * 1.25, true)} aria-label="Zoom in" title="Zoom in">+</button>
          <span className="flow-zoom-pct">{Math.round(view.s * 100)}%</span>
          <button className="flow-zoom-fit" onClick={() => fit(target, true)} title="Fit the current selection on the screen">Fit</button>
        </div>
      </div>
      {relations.length === 0 && <div className="flow-empty">No relations between plans are documented yet.</div>}
    </div>
  );
}
