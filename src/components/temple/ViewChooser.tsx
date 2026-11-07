import type { ViewDefinition } from "./views";

/**
 * The first thing a visitor sees: what this page is, and a tile with a preview for every visualisation. The choice is
 * written to the link (view=<id>) only once someone picks.
 */
export function ViewChooser({ views, onPick, current }: { views: ViewDefinition[]; onPick: (id: string) => void; current?: string }) {
  return (
    <main className="chooser" aria-labelledby="chooser-title">
      <h2 id="chooser-title">Choose a view</h2>
      <p className="chooser-lead">
        This is a visual representation of the SAAF-Project repositories: every plan in the project, how far it has come, and how the plans connect. The same data is available in more than one picture. Choose one to start; you can change it at any time.
      </p>
      <ul className="chooser-tiles">
        {views.map((v) => (
          <li key={v.id}>
            <button className={`chooser-tile${v.id === current ? " on" : ""}`} onClick={() => onPick(v.id)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed preview, next/image would add nothing here */}
              <img src={v.previewUrl} alt="" loading="lazy" />
              <b>{v.name}</b>
              <span>{v.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
