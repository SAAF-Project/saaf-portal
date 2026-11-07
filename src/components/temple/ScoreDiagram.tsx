import type { ProgressData } from "./types";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * How a plan's score is built up, drawn from the weights in the data itself (the same numbers the scoring code uses),
 * so the picture cannot drift from the calculation. The example is a plan whose Plan phase is complete and whose Do
 * phase is in progress.
 */
export function ScoreDiagram({ weights }: { weights: ProgressData["weights"] }) {
  const phases = [
    { name: "Plan", state: "complete", w: weights.complete },
    { name: "Do", state: "in progress", w: weights.in_progress },
    { name: "Check", state: "not started", w: weights.not_started },
    { name: "Act", state: "not started", w: weights.not_started },
  ];
  const score = phases.reduce((s, p) => s + p.w, 0) / phases.length;
  const rowH = 34;
  return (
    <svg className="score-diagram" viewBox="0 0 450 150" role="img" aria-label={`A plan's score is the average of its four phases. Example: Plan complete (${weights.complete}), Do in progress (${weights.in_progress}), Check and Act not started (${weights.not_started}) gives ${pct(score)}.`}>
      {phases.map((p, i) => (
        <g key={p.name} transform={`translate(0 ${6 + i * rowH})`}>
          <rect width="150" height="28" rx="6" className="sd-box" />
          <text x="10" y="18" className="sd-name">{p.name}</text>
          <text x="140" y="18" textAnchor="end" className="sd-muted">{p.state} = {p.w}</text>
          <path d={`M150 14 H175 V${68 - 6 - i * rowH} H200`} className="sd-line" fill="none" />
        </g>
      ))}
      <rect x="200" y="46" width="110" height="44" rx="8" className="sd-box sd-strong" />
      <text x="255" y="65" textAnchor="middle" className="sd-name">average of 4</text>
      <text x="255" y="81" textAnchor="middle" className="sd-muted">({weights.complete} + {weights.in_progress} + {weights.not_started} + {weights.not_started}) / 4</text>
      <path d="M310 68 H348" className="sd-line" fill="none" markerEnd="url(#sd-arrow)" />
      <rect x="350" y="46" width="90" height="44" rx="8" className="sd-box" />
      <text x="395" y="65" textAnchor="middle" className="sd-name">plan score</text>
      <text x="395" y="81" textAnchor="middle" className="sd-muted">{pct(score)}</text>
      <defs>
        <marker id="sd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" className="sd-head" />
        </marker>
      </defs>
    </svg>
  );
}
