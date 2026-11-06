/**
 * Reads the visualization.yaml of every visualisation (src/components/temple/views/<id>/) and checks it.
 * Server only: it reads files. The page passes the result to the client, so the browser never needs a YAML parser.
 * A mistake in a file throws with the file name in the message, so the build or the page fails loudly instead of
 * showing a half-working view.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { parseManifest, type VisualisationManifest } from "../components/temple/visualisation";

export const VIEWS_DIR = join(process.cwd(), "src", "components", "temple", "views");

export function loadManifests(dir: string = VIEWS_DIR): VisualisationManifest[] {
  const manifests: VisualisationManifest[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, "visualization.yaml");
    if (!existsSync(file)) continue;
    const label = `views/${entry.name}/visualization.yaml`;
    const manifest = parseManifest(load(readFileSync(file, "utf8")), label);
    if (manifest.id !== entry.name) throw new Error(`${label}: "id" (${manifest.id}) must match the folder name (${entry.name})`);
    if (!existsSync(join(dir, entry.name, manifest.preview))) throw new Error(`${label}: preview picture "${manifest.preview}" not found next to the file`);
    manifests.push(manifest);
  }
  return manifests.sort((a, b) => a.id.localeCompare(b.id));
}
