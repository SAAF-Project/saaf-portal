import type { PrizeRow, PrizesPayload } from "../../../lib/standards-prizes";
import { clock } from "./StandardsView";

// The prizes panel of the standards board: who leads for the two prizes the board decides. Pure: it draws the payload
// it is given (StandardsBoard.tsx fetches it), so it can be rendered in a test. The portal works the prizes out itself
// from GitHub's history (src/lib/standards-prizes.ts); nobody has to do anything on the day.

function By({ logins }: { logins: string[] }) {
  if (logins.length === 0) return null;
  return <span className="block text-xs font-mono text-muted [overflow-wrap:anywhere]">{logins.map((l) => `@${l}`).join(" · ")}</span>;
}

function Rows({ rows, value, empty }: { rows: PrizeRow[]; value: (r: PrizeRow) => string; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted py-2 border-t border-border">{empty}</p>;
  return (
    <ol className="border-t border-border">
      {rows.map((r, i) => (
        <li key={r.name} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-3 items-baseline py-2 border-b border-border">
          <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
          <span className="min-w-0">
            <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="font-medium [overflow-wrap:anywhere]">
              {r.name}
            </a>
            <By logins={r.by} />
          </span>
          <span className="font-mono text-sm tabular-nums text-right">{value(r)}</span>
        </li>
      ))}
    </ol>
  );
}

export default function PrizesView({ payload }: { payload: PrizesPayload | null }) {
  if (!payload) return null;
  const startsAt = clock(payload.start);
  const endsAt = clock(payload.end);

  if (payload.phase === "before") {
    return (
      <section aria-labelledby="prizes-title" className="mb-8">
        <h2 id="prizes-title" className="text-lg font-medium mb-1">The prizes.</h2>
        <p className="text-sm text-muted leading-relaxed max-w-[680px]">
          Counting starts at {startsAt} on 17 November and closes at {endsAt}. The portal reads the default branch of every
          repo at {startsAt} from GitHub&apos;s history and compares it with the board. Only repos that exist at {startsAt} count.
        </p>
      </section>
    );
  }

  const status = payload.phase === "after" ? `Final, counted at ${endsAt}` : `Live since ${startsAt}, closes at ${endsAt}`;
  const notes = [status];
  if (payload.tiles) notes.push(`${payload.tiles.start} tiles at ${startsAt}, ${payload.tiles.now} ${payload.phase === "after" ? `at ${endsAt}` : "now"}`);
  if (payload.unread > 0) notes.push(`${payload.unread} ${payload.unread === 1 ? "repo" : "repos"} not read yet`);

  return (
    <section aria-labelledby="prizes-title" className="mb-8">
      <h2 id="prizes-title" className="text-lg font-medium mb-1">The prizes.</h2>
      <p className="text-xs font-mono text-muted mb-4">{notes.join(" · ")}</p>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-medium mb-2">First existing agent with nine tiles</h3>
          <Rows rows={payload.first_nine} value={(r) => (r.reached_at ? clock(r.reached_at) : "")} empty="No repo has all nine yet." />
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Biggest jump since {startsAt}</h3>
          <Rows rows={payload.biggest_jump} value={(r) => `+${r.jump} (${r.before}→${r.after})`} empty="No tiles turned on yet." />
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">New today, for the organisers</h3>
          {payload.new_repos.length === 0 ? (
            <p className="text-sm text-muted py-2 border-t border-border">No new repos yet.</p>
          ) : (
            <ul className="border-t border-border">
              {payload.new_repos.map((r) => (
                <li key={r.name} className="flex justify-between gap-3 py-2 border-b border-border">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="[overflow-wrap:anywhere]">
                    {r.name}
                  </a>
                  <span className="font-mono text-sm tabular-nums text-muted">{r.met}/9</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
