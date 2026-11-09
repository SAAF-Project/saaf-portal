import { useEffect, useRef } from "react";

/**
 * Tells the host that the picture has really been drawn. Put it as the last child of everything that can still be
 * loading: inside a react-three-fiber <Canvas> it only mounts once the textures are in, in a plain view it mounts with
 * the view. The host waits for this before it starts a tour by itself, so a first visit on a slow connection (or the
 * first compile in `npm run dev`) never shows a tour card on an empty page.
 */
export function ViewReady({ onReady }: { onReady?: () => void }) {
  const callback = useRef(onReady);
  useEffect(() => {
    callback.current = onReady;
  });
  useEffect(() => {
    let second = 0;
    // two frames: the first one paints the scene, the second one is the picture the visitor sees
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => callback.current?.());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return null;
}
