import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { Theme } from "./colors";

/**
 * Photoreal accents: a sky and a stone-paved ground (AI-generated pictures, see public/accents/). They are static,
 * the geometry of the temple stays data-driven, and they never touch the plan colours. If a picture is missing
 * the scene falls back to flat colours.
 */
export interface Accents {
  sky: THREE.Texture | null;
  ground: THREE.Texture | null;
  horizon: string | null; // sky colour just above the horizon: used for fog and background so the ground melts into the sky
}

// where the horizon lies in each sky picture, measured from the top (0) to the bottom (1)
const SKY = {
  dark: { file: "accents/sky-dusk.jpg", horizon: 0.86 },
  light: { file: "accents/sky-day.jpg", horizon: 0.9 },
};
const GROUND_FILE = "accents/ground-stone.jpg";
export const GROUND_TILE = 14; // world units covered by one picture of the paving

function load(url: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        resolve(t);
      },
      undefined,
      () => resolve(null),
    );
  });
}

/** Average colour of a thin horizontal band of the picture at v (0..1 from the top). */
export function bandColor(image: { width: number; height: number } & CanvasImageSource, v: number): string | null {
  if (!image.width) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const band = Math.max(2, image.height * 0.02);
  ctx.drawImage(image, 0, Math.max(0, image.height * v - band / 2), image.width, band, 0, 0, 64, 1);
  const px = ctx.getImageData(0, 0, 64, 1).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < 64; i++) {
    r += px[i * 4];
    g += px[i * 4 + 1];
    b += px[i * 4 + 2];
  }
  return `rgb(${Math.round(r / 64)}, ${Math.round(g / 64)}, ${Math.round(b / 64)})`;
}

const NO_ACCENTS: Accents = { sky: null, ground: null, horizon: null };

/** Loads the pictures for the theme (nothing when scenery is off). */
export function useAccents(theme: Theme, enabled: boolean, assetBase = "/"): Accents {
  const [loaded, setLoaded] = useState<{ theme: Theme; accents: Accents } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const base = assetBase.endsWith("/") ? assetBase : `${assetBase}/`;
    Promise.all([load(base + SKY[theme].file), load(base + GROUND_FILE)]).then(([sky, ground]) => {
      if (cancelled) return;
      if (ground) ground.wrapS = ground.wrapT = THREE.MirroredRepeatWrapping; // mirrored edges tile without a visible seam
      const image = sky?.image as (HTMLImageElement & CanvasImageSource) | undefined;
      setLoaded({ theme, accents: { sky, ground, horizon: image ? bandColor(image, SKY[theme].horizon - 0.05) : null } });
    });
    return () => {
      cancelled = true;
    };
  }, [theme, enabled, assetBase]);
  // switched off, or still showing the other theme's pictures: nothing until the right ones are loaded
  return enabled && loaded?.theme === theme ? loaded.accents : NO_ACCENTS;
}

const R = 210; // distance of the sky from the temple
const H = 130; // height of the sky picture in the world
const ARC = (120 * Math.PI) / 180;

/** Sky: a wide arc behind the temple, so the horizon stays where it is when the camera moves. */
export function SkyArc({ texture, theme, centreX }: { texture: THREE.Texture; theme: Theme; centreX: number }) {
  // theta 0 points along +z; the arc is centred on -z, the side the temple faces away from
  const geometry = useMemo(() => new THREE.CylinderGeometry(R, R, H, 48, 1, true, Math.PI - ARC / 2, ARC), []);
  // the picture's horizon line goes to world height 0
  const y = SKY[theme].horizon * H - H / 2;
  return (
    <mesh geometry={geometry} position={[centreX, y, 0]} raycast={() => null}>
      <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} fog={false} />
    </mesh>
  );
}

/** Ground: stone paving, big enough to reach the sky, tinted down in the dark theme so the pieces stand out. */
export function Paving({ texture, theme, centreX }: { texture: THREE.Texture; theme: Theme; centreX: number }) {
  const W = 900;
  const D = 520;
  const map = useMemo(() => {
    const t = texture.clone();
    t.needsUpdate = true;
    t.repeat.set(W / GROUND_TILE, D / GROUND_TILE);
    return t;
  }, [texture]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centreX, -0.02, 0]} raycast={() => null}>
      <planeGeometry args={[W, D]} />
      <meshStandardMaterial map={map} color={theme === "dark" ? "#6d7690" : "#f4f1ec"} roughness={1} />
    </mesh>
  );
}
