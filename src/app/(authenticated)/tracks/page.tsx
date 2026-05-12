import { readFileSync } from "fs";
import { join } from "path";
import type { Track, Plan } from "@/types";
import TrackCard from "@/components/TrackCard";

function loadData<T>(filename: string): T {
  const filePath = join(process.cwd(), "public", "data", filename);
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

export default function TracksPage() {
  const tracks = loadData<Track[]>("tracks.json");
  const plans = loadData<Plan[]>("plans.json");

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">Tracks</h1>

      {/* PDCA explanation */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-4">
        <h3 className="text-base font-bold text-accent mb-2">
          PDCA Cycle — What happens when?
        </h3>
        <p className="text-muted text-sm mb-4">
          SAAF sessions follow a Plan-Do-Check-Act loop across hackathons.
          Hackathon days cover <strong className="text-text">Plan & Do</strong>.
          The other phases happen at your organisation between sessions.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-saaf-green/7 rounded-lg border-l-3 border-saaf-green">
            <div className="font-bold text-xs text-saaf-green mb-1">
              Plan & Do — hackathon day
            </div>
            <ul className="text-xs text-muted list-disc pl-4 space-y-1">
              <li>
                <strong className="text-text">Plan:</strong> design your agent,
                skill, or workflow
              </li>
              <li>
                <strong className="text-text">Do:</strong> build a working
                prototype in your track
              </li>
            </ul>
          </div>
          <div className="p-3 bg-muted/7 rounded-lg border-l-3 border-muted">
            <div className="font-bold text-xs text-muted mb-1">
              Check & Act — between sessions
            </div>
            <ul className="text-xs text-muted list-disc pl-4 space-y-1">
              <li>
                <strong className="text-text">Check:</strong> test at your
                organisation, collect findings
              </li>
              <li>
                <strong className="text-text">Act:</strong> share results &
                improvements at next hackathon
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Way of Working */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h3 className="text-base font-bold mb-2">Way of Working</h3>
        <p className="text-muted text-sm mb-3">
          Clone the repo, find your plan, fork & branch, build in your track,
          open a PR. Plans link directly to GitHub — click any plan card below to
          read it.
        </p>
        <div className="flex gap-2 flex-wrap mb-3">
          <a
            href="/onboarding"
            className="inline-block px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-text text-sm font-medium no-underline hover:bg-white/10"
          >
            How to contribute →
          </a>
          <a
            href="https://github.com/SAAF-Project/SAAF-Project"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-text text-sm font-medium no-underline hover:bg-white/10"
          >
            Repository ↗
          </a>
          <a
            href="https://github.com/SAAF-Project/SAAF-Project/blob/main/plans/overview.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-text text-sm font-medium no-underline hover:bg-white/10"
          >
            All 60 Plans ↗
          </a>
        </div>
        <div className="p-2 px-3 bg-surface2 rounded-md text-xs text-muted">
          <code className="text-text">git clone</code> the repo →{" "}
          branch <code className="text-text">your-name/feature</code> →{" "}
          build → open PR to <code className="text-text">main</code>
        </div>
      </div>

      {/* Track cards */}
      {tracks.map((track) => {
        const trackPlans = plans.filter((p) => p.track === track.id);
        return (
          <TrackCard key={track.id} track={track} plans={trackPlans} />
        );
      })}
    </div>
  );
}
