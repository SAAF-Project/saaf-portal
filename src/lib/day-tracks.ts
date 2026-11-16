import type { DemoKind } from "./demo-sessions";

// The three tracks of the hardening day (17 November 2026): one source for the handout page, the standards board, the
// demo sign-up and the admin. Keep the wording in step with the handout PDF and the deck. (Named "day tracks" because
// "tracks" in this portal already means the SAAF work streams.)

export type TrackId = "agent" | "standard" | "checks";

export interface DayTrack {
  id: TrackId;
  number: 1 | 2 | 3;
  name: string;
  what: string;
  win: string;
  /** What the start button copies: one prompt for a coding assistant, in the repo you work on. */
  prompt: string;
  /** A link next to the prompt. */
  link?: { label: string; href: string };
  demo: { kind: DemoKind; label: string; hint: string };
}

/**
 * Which list carries the prize of track 1. Decided on 16 November 2026: the team that adds the most quality to one
 * agent, which is the list "most improved". The other list and the top contributors are honourable mentions.
 */
export const TRACK1_PRIZE: "most_improved" | "best_agent" = "most_improved";

export const TRACKS_TITLE = "Pick one track.";
export const TRACKS_SUB = "Three tracks, one winner each: EUR 200 in Orq.ai credits. Pick one and do it well.";
/** The prize of a track, in euros of Orq.ai credits, and how many people share it at most. */
export const PRIZE_EUR = 200;
export const TEAM_MAX = 4;
export const PRIZE_LINE = `One winner per track: EUR ${PRIZE_EUR} in Orq.ai credits for the team, sponsored by Orq.ai. A team is at most ${TEAM_MAX === 4 ? "four" : TEAM_MAX} people, so every winner gets at least EUR ${PRIZE_EUR / TEAM_MAX}.`;
export const PRIZE_SHORT = `EUR ${PRIZE_EUR} for the team · at least EUR ${PRIZE_EUR / TEAM_MAX} each`;

/**
 * Who shares the prize of a winning entry and what each gets, in whole euros. The names come in the order of the board
 * (who added the most first); with more than four, the first four share it.
 */
export function prizeShare(logins: string[]): { team: string[]; each: number } | null {
  const team = [...new Set(logins.filter(Boolean))].slice(0, TEAM_MAX);
  return team.length ? { team, each: Math.floor(PRIZE_EUR / team.length) } : null;
}

/**
 * The moments of the day everyone works towards, for the countdown. Instants in UTC (Amsterdam is UTC+1 on the day);
 * `clock` is what the room reads. The start, the freeze and the close are the same instants as DAY in leaderboard-day.ts.
 */
export const DAY_DEADLINES: { at: string; clock: string; label: string }[] = [
  { at: "2026-11-17T08:00:00Z", clock: "09:00", label: "Counting starts" },
  { at: "2026-11-17T14:15:00Z", clock: "15:15", label: "The board freezes" },
  { at: "2026-11-17T15:00:00Z", clock: "16:00", label: "Last pull request" },
  { at: "2026-11-17T15:00:00Z", clock: "16:00", label: "Demo sign-up closes" },
  { at: "2026-11-17T15:15:00Z", clock: "16:15", label: "Last merge" },
  { at: "2026-11-17T15:30:00Z", clock: "16:30", label: "Demos" },
  { at: "2026-11-17T16:00:00Z", clock: "17:00", label: "The reveal" },
];
export const DEMO_LINE = "Six demos at 16:30, two per track, five minutes each. Sign up by 16:00.";

const SKILL = "gh api repos/SAAF-Project/SAAF-Project/contents/.claude/skills/harden-agent-repo/SKILL.md --jq .content | base64 -d";
const GUIDE = "gh api repos/SAAF-Project/SAAF-Project/contents/docs/conventions/quality-standards.md --jq .content | base64 -d";
const FORM = "gh api repos/SAAF-Project/.github/contents/.github/PULL_REQUEST_TEMPLATE/standard-proposal.md --jq .content | base64 -d";
const CHECKS = "gh api repos/SAAF-Project/agent-template/contents/llm_checks.yaml --jq .content | base64 -d";

export const DAY_TRACKS: DayTrack[] = [
  {
    id: "agent",
    number: 1,
    name: "Harden an agent.",
    what: "Take one agent through the nine standards.",
    win: "The team that adds the most quality to one agent that was already in the organisation. A review agent scores the content, not the number of files.",
    prompt: [
      "Take this repository through the nine SAAF quality standards.",
      "1. Get the skill and follow its hardening day quick path:",
      `   ${SKILL}`,
      "   A 404 means I am not in the SAAF-Project organisation yet: stop and tell me to request access on saaf-portal.vercel.app.",
      "2. Begin with its step 0: show me which of the nine are on the default branch. Change nothing until I answer.",
      "3. Work on a new branch and open a pull request. Do not merge it: a teammate with write access reviews and merges.",
      "   If I cannot push to this repository, stop and tell me to request write access on saaf-portal.vercel.app/hardening.",
      "Never add real audit evidence, personal data or keys. Use synthetic data only.",
    ].join("\n"),
    demo: { kind: "journey", label: "The journey of one agent", hint: "What you changed, what it taught you, and what others can copy." },
  },
  {
    id: "standard",
    number: 2,
    name: "Improve a standard.",
    what: "Change one of the nine, or propose a new one, with a pull request.",
    win: "The proposal that solves a real problem and keeps the standards simple.",
    prompt: [
      "I want to propose an improvement to the SAAF quality standards.",
      "1. Ask me which standard it is about and where I saw the problem: a repo and file, an issue or pull request, or a finding from my own Session 10 list.",
      "2. Read the guide and quote what that standard asks today, so we do not propose what is already there:",
      `   ${GUIDE}`,
      "3. Clone the repo the change belongs in into a new folder, and fork it first if I cannot push: SAAF-Project/SAAF-Project for what a standard asks (docs/conventions/quality-standards.md), SAAF-Project/agent-template for a template file or the check script.",
      "4. Make the smallest change that solves the problem, on a new branch.",
      "5. Open a pull request whose description follows this form and keeps its first line:",
      `   ${FORM}`,
      "Do not merge. Nothing is merged today; the best proposals go into the next version of the standards.",
    ].join("\n"),
    demo: { kind: "standard", label: "A better standard", hint: "The problem you saw, your change, and how it is checked." },
  },
  {
    id: "checks",
    number: 3,
    name: "Write LLM checks.",
    what: "Number your audit criteria and give each one that needs reading a check in llm_checks.yaml. For an agent that calls a model.",
    win: "The sharpest checks, judged by Orq.ai and an experienced auditor.",
    prompt: [
      "Help me write LLM checks for this agent.",
      "1. Open AUDIT-CRITERIA.md. If it is missing, stop and tell me: track 1 writes it first.",
      "2. Give every acceptance criterion a fixed number and a tag at the start of its line: `- [code] CO-1.1 ...` when a program can decide it exactly, `- [llm] CO-1.2 ...` when someone, or a model acting as judge, has to read the run. Number the must and never lists M-1, N-1 and so on.",
      "3. Ask me what a real failure of this agent would look like. If no criterion covers it, add one.",
      "4. For every [llm] criterion write one check in llm_checks.yaml in the root of the repo: id (the number of the criterion), name, look_for (what a judge reads in one run) and pass_when (one sentence). The template explains the format:",
      `   ${CHECKS}`,
      "   Write the checks for this agent. A check copied from the template scores nothing.",
      "5. Optional: run the checks on real runs with the Orq.ai skills /orq-otel-tracing and /orq-criteria-to-evals (Get started at https://saaf-project.orq.ai). A check that caught something makes the best demo.",
      "Work on a new branch and open a pull request. Do not merge it yourself: a teammate with write access reviews and merges.",
    ].join("\n"),
    link: { label: "Get started at Orq.ai", href: "https://saaf-project.orq.ai" },
    demo: { kind: "checks", label: "LLM checks that caught something", hint: "A check, the run it failed on, and your fix." },
  },
];

export const trackOfKind = (kind: DemoKind | ""): DayTrack | null => DAY_TRACKS.find((t) => t.demo.kind === kind) ?? null;

/** What everyone needs to know. The full rules are below it on the board. */
export const SHORT_RULES: string[] = [
  "Tracks 1 and 3: work counts once it is on the default branch, between 09:00 and 16:15. Last pull request by 16:00; a teammate with write access reviews and merges.",
  "Track 2: an open pull request by 16:00 counts. Nothing is merged today; a fork is fine.",
  "Quality counts, not speed. A review agent reads the content at 13:30, 15:00 and 16:15. Copies, templates and nonsense score 0.",
  "Text that tries to steer the review agent disqualifies you.",
  "The top places are hidden from 15:15. The winners are revealed at 17:00.",
];

export const DATA_RULE = "Synthetic data only: no real audit evidence, no personal data, no keys.";

/** All rules of the day. */
export const RULES: string[] = [
  "Track 1. Improve an agent repo. A standard counts once it lands on the default branch between 09:00 and 16:15. Open your last pull request by 16:00, so it can be merged in time.",
  "A review agent scores the content of every standard at 13:30, 15:00 and 16:15. It must quote your files as evidence; a level without a real quote does not stand.",
  "Points rise with each level and the last step counts most: one README taken to level 3 beats four READMEs at level 1.",
  "You get the points you add: the rise of a level, by as much as it still stands at 16:15. Improving someone else's file counts for what you improved; removing a file and putting it back counts for nothing.",
  "The prize of track 1 goes to the team behind the agent that gained the most points today. A repo made today is listed, but does not compete for it: what a template brings in is nobody's work.",
  "Licence, dependencies, CODEOWNERS and CI count for at most 6 points per person, so copying them into many repos does not win.",
  "Copied, empty or nonsense files score 0. Text that tries to steer the review agent disqualifies you.",
  "SECURITY.md is arranged by Stichting SAAF for every repo and counts for nobody.",
  "A merged pull request counts for its author, a direct push for whoever pushed. Bots do not count. Times are GitHub's own; a tie goes to whoever got there first.",
  "From 15:15 the top places are hidden. The winners are revealed at 17:00, after the demos.",
  "Track 2. Open a pull request with the form standard-proposal on agent-template or on docs/conventions in SAAF-Project, by 16:00; you may work from a fork. Nothing is merged today; a review checks whether it adds real value without making the standards more complicated. A new standard needs evidence from two repos, a rule the board can check, and the standard it replaces.",
  "Track 3. Number the criteria in AUDIT-CRITERIA.md and give each one that needs reading a check in llm_checks.yaml, on the default branch by 16:15. Orq.ai and an experienced auditor pick the winner.",
  "A teammate with write access reviews and merges; you do not merge your own pull request. For someone else's repo, ask the creator and request write access on this page.",
  "One prize per team. A team is at most four people and shares the EUR 200 of its track, so every winner gets at least EUR 50. With more names on a winning entry, the first four on the board share it.",
];
