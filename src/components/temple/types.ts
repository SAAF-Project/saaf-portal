// Shape of SAAF-Project/website/data/progress.json (written by tools/scripts/generate_dashboard.py).

export type PhaseStatus = "complete" | "in_progress" | "not_started";
export type PhaseKey = "plan" | "do" | "check" | "act";
export type RepoStatus = "dedicated" | "duplicate" | "main-repo" | "missing" | "not-needed";
export type PartKind = "foundation" | "pillar" | "roof" | "quarry" | "annex";
export type TrackSource = "workstreams" | "proposed" | "none";
export type PlanKind = "agent" | "workflow" | "skill" | "document" | "unspecified";
export type Severity = "error" | "warning" | "info";

export interface RepoRef {
  name: string;
  url: string;
  source: string;
}

export interface CodeRef {
  path: string;
  url: string;
  source: string;
}

export interface AlertRecord {
  id: string;
  severity: Severity;
  message: string;
}

export interface AlertDefinition {
  id: string;
  severity: Severity;
  label: string;
  hint: string;
}

export interface StageDefinition {
  id: number;
  key: string;
  label: string;
  hint: string;
}

export interface PlanRecord {
  slug: string;
  title: string;
  session: string;
  part: string;
  track: number | null;
  track_source: TrackSource;
  track_reason: string;
  type: string;
  status: string;
  pdca: Record<PhaseKey, PhaseStatus>;
  pdca_known: boolean;
  progress: number;
  quality_score: number;
  organisation: string;
  submitter: string;
  claimed_by: string;
  sectors: string[];
  sector_source: string;
  repo: RepoRef | null;
  repo_alternatives: RepoRef[];
  main_repo_code: CodeRef[];
  repo_note: string;
  repo_status: RepoStatus;
  github_url: string;
  problem_summary: string;
  updated: string | null; // date of the last commit that touched the plan file
  kind: PlanKind;
  stage: number; // index into ProgressData.stages (decided by the generator)
  stage_key: string;
  alerts: AlertRecord[];
}

export interface Rollup {
  plan_count: number;
  plans_unknown: number;
  progress: number | null;
  phase_progress: Record<PhaseKey, number | null>;
  phases: Record<PhaseStatus, number>;
  repo_count: number;
  repo_status: Partial<Record<RepoStatus, number>>;
}

export interface PartRecord extends Rollup {
  id: string;
  kind: PartKind;
  track: number | null;
  stage: string | null;
  position: number;
  name: string;
  mission: string;
  team: Record<string, number>;
  plans: string[];
}

export interface AnnexItem {
  plan: string;
  title: string;
  part: string;
  status: RepoStatus;
  primary: RepoRef | null;
  duplicates: RepoRef[];
  main_repo_code: CodeRef[];
  note: string;
}

export interface Guidance {
  title: string;
  steps: string[];
}

export interface Annex {
  name: string;
  items: AnnexItem[];
  guidance: {
    config: { mapping_file: string; plan_row: string; refresh: string };
    duplicate: Guidance;
    "main-repo": Guidance;
    missing: Guidance;
  };
}

export interface ProgressData {
  schema_version: number;
  generated?: string; // date (YYYY-MM-DD) the generator ran
  weights: Record<PhaseStatus, number>;
  stages: StageDefinition[];
  kinds: PlanKind[];
  alert_catalog: AlertDefinition[];
  sector_vocabulary: string[];
  project: Rollup & { name: string };
  parts: PartRecord[];
  annex: Annex;
  plans: PlanRecord[];
  relations?: Relation[]; // which plan feeds which; absent until the generator writes it (then it wins over relations.json)
}

// What the camera/panel is focused on. Mirrors the URL hash: #/ , #/part/<id>, #/plan/<slug>, #/annex[/<slug>]
export type Focus =
  | { level: "project" }
  | { level: "part"; partId: string }
  | { level: "plan"; slug: string }
  | { level: "annex"; slug?: string };

// Which plan's output is another plan's input (relations.json, until the generator writes them into progress.json).
export type RelationStatus = "suggested" | "confirmed";

export interface RelationSource {
  file: string; // path in SAAF-Project, e.g. plans/hackathon-2/x.md
  line?: number;
  quote: string; // the words the relation was read from
}

export interface Relation {
  from: string; // plan slug that produces
  to: string; // plan slug that consumes
  what: string; // what flows, e.g. "RCM"; may be empty
  status: RelationStatus; // "suggested" = an AI reading of the plan texts, "confirmed" = checked by an owner
  sources: RelationSource[];
  note?: string;
  confirmed_by?: string;
}

export interface RelationsFile {
  schema_version: number;
  updated: string;
  description?: string;
  relations: Relation[];
}
