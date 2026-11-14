import { STANDARDS } from "./standards";

// The nine standards as a numbered list: what it is, where the board looks for it, and why it is there.
// The numbers are the column numbers of the board at /standards.
export default function StandardsChecklist() {
  return (
    <ol className="border-t border-border">
      {STANDARDS.map((s, i) => (
        <li key={s.id} className="grid grid-cols-[28px_1fr] sm:grid-cols-[28px_180px_1fr] gap-x-3 gap-y-1 py-2 border-b border-border text-sm">
          <span className="font-mono text-muted">{i + 1}</span>
          <span className="font-medium">{s.label}</span>
          <div className="col-start-2 sm:col-start-3 min-w-0">
            <p className="text-muted leading-relaxed">{s.why}</p>
            <p className="font-mono text-xs text-muted leading-relaxed mt-0.5">{s.file}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
