import { useEffect, useRef, useState } from "react";
import type { Theme } from "./colors";
import type { DisplayOption } from "./visualisation";

interface Props {
  options: DisplayOption[]; // what the current view supports (from its visualization.yaml)
  scenery: boolean;
  onScenery: (on: boolean) => void;
  style: "sketch" | "clean";
  onStyle: (style: "sketch" | "clean") => void;
  theme: Theme;
  onToggleTheme?: () => void; // omit when the host owns the theme (the portal)
}

/**
 * Personal display preferences, kept apart from Tour and Filters. Only the options the current view supports show up,
 * and without any option there is no button at all.
 */
export function DisplayMenu({ options, scenery, onScenery, style, onStyle, theme, onToggleTheme }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  if (!options.length && !onToggleTheme) return null;

  return (
    <div className="dmenu" ref={root} data-tour="display">
      <button aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>Display ▾</button>
      {open && (
        <div className="dmenu-pop" role="group" aria-label="Display">
          {options.includes("scenery") && (
            <div className="dmenu-row">
              <span className="flabel">Scenery</span>
              <div className="segmented" role="group" aria-label="Scenery">
                <button className={scenery ? "on" : ""} aria-pressed={scenery} onClick={() => onScenery(true)} title="Decoration around the picture (AI-generated sky and ground, trees and boats)">On</button>
                <button className={!scenery ? "on" : ""} aria-pressed={!scenery} onClick={() => onScenery(false)}>Off</button>
              </div>
            </div>
          )}
          {options.includes("style") && (
            <div className="dmenu-row">
              <span className="flabel">Lines</span>
              <div className="segmented" role="group" aria-label="Line style">
                <button className={style === "clean" ? "on" : ""} aria-pressed={style === "clean"} onClick={() => onStyle("clean")}>Clean</button>
                <button className={style === "sketch" ? "on" : ""} aria-pressed={style === "sketch"} onClick={() => onStyle("sketch")}>Sketch</button>
              </div>
            </div>
          )}
          {onToggleTheme && (
            <div className="dmenu-row">
              <span className="flabel">Theme</span>
              <div className="segmented" role="group" aria-label="Theme">
                <button className={theme === "light" ? "on" : ""} aria-pressed={theme === "light"} onClick={() => theme !== "light" && onToggleTheme()}>Light</button>
                <button className={theme === "dark" ? "on" : ""} aria-pressed={theme === "dark"} onClick={() => theme !== "dark" && onToggleTheme()}>Dark</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
