import * as THREE from "three";

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const LINE_H = 1.2; // keep in step with tags.ts
const MAX_PX = 2048; // longest side of a name texture

/** Breaks `text` into lines that fit `width` at the context's current font; null when a single word is wider. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] | null {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width) line = next;
    else {
      if (ctx.measureText(word).width > width) return null;
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The first `max` lines of `text` at the current font, the last one cut short with "…" when text is left over. */
function cut(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const fits = (s: string) => ctx.measureText(s).width <= width;
  const lines: string[] = [];
  let rest = text.trim();
  while (rest && lines.length < max) {
    // the longest run of whole words that fits, or of letters when the first word alone is wider than the line
    let end = rest.length;
    if (!fits(rest)) {
      let space = rest.lastIndexOf(" ");
      while (space > 0 && !fits(rest.slice(0, space))) space = rest.lastIndexOf(" ", space - 1);
      if (space > 0) end = space;
      else while (end > 1 && !fits(rest.slice(0, end))) end--;
    }
    lines.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

const cache = new Map<string, THREE.CanvasTexture>();

export interface NameStyle {
  ink?: string;
  maxLines?: number;
  minFont?: number; // smallest letter height, in world units; a name that only fits smaller is cut off with "…"
}

/**
 * A plan's name on a transparent texture of aspect w : h (world units), written as large as fits on up to `maxLines`
 * lines. Cached: the same name on the same shape of face shares one texture.
 */
export function nameTexture(text: string, w: number, h: number, style: NameStyle = {}): THREE.CanvasTexture {
  const { ink = "rgba(20, 28, 50, 0.82)", maxLines = 3, minFont = 0 } = style;
  const key = `${text}|${w.toFixed(3)}|${h.toFixed(3)}|${ink}|${maxLines}|${minFont}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const scale = Math.min(MAX_PX / Math.max(w, h), 384 / h); // pixels per world unit: sharp up close, within a sane size
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, Math.round(w * scale));
  canvas.height = Math.max(8, Math.round(h * scale));
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width, H = canvas.height;
  const floor = Math.max(6, minFont * scale);

  // the largest font at which the whole name wraps into the box; at the floor, cut it off instead
  let size = H / LINE_H;
  let lines: string[] | null = null;
  for (; size > floor; size *= 0.94) {
    ctx.font = `600 ${size}px ${FONT}`;
    const max = Math.min(maxLines, Math.floor(H / (size * LINE_H)));
    const wrapped = max >= 1 ? wrap(ctx, text, W) : null;
    if (wrapped && wrapped.length <= max) {
      lines = wrapped;
      break;
    }
  }
  if (!lines) {
    size = floor;
    ctx.font = `600 ${size}px ${FONT}`;
    lines = cut(ctx, text, W, Math.max(1, Math.min(maxLines, Math.floor(H / (size * LINE_H)))));
  }

  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const top = H / 2 - ((lines.length - 1) * size * LINE_H) / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * size * LINE_H));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  cache.set(key, texture);
  return texture;
}
