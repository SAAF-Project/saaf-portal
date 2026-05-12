import type { TrackTasks } from "@/types";

export const TRACK_TASKS: TrackTasks = {
  0: [
    { time: "45m", task: "Deploy Strapi Docker + seed 5 content types" },
    {
      time: "60m",
      task: "Set up ChromaDB + ingest regulatory corpus into RAG KB",
    },
    { time: "45m", task: "Stand up Jira + Confluence MCP servers" },
    { time: "60m", task: "Implement Loop SDK core (Task, Loop, Agent)" },
    {
      time: "rest",
      task: "Helpdesk: support other tracks integrating with infra",
    },
  ],
  1: [
    {
      time: "45m",
      task: "UC1: Ingest synthetic policy → extract Context Brief",
    },
    {
      time: "45m",
      task: "UC3: Query Jira incidents via MCP → classify for audit",
    },
    { time: "45m", task: "UC4: Generate fraud scenarios (procure-to-pay)" },
    {
      time: "45m",
      task: "UC2+UC5: RAG lookup for previous audits + regulatory criteria",
    },
    {
      time: "90m",
      task: "UC7: Build Risk Control Matrix from all inputs",
    },
    { time: "45m", task: "UC8: Generate work program from RCM" },
    { time: "30m", task: "UC9: Quality check entire pipeline output" },
  ],
  2: [
    {
      time: "60m",
      task: "OCR extraction: run on 3 synthetic PDFs (access, change, BCP)",
    },
    {
      time: "45m",
      task: "Access review: run on 200-record Strapi dataset",
    },
    {
      time: "45m",
      task: "CLI wrapper: test 3 allowlisted commands (AD, Splunk, patch)",
    },
    {
      time: "45m",
      task: "Fieldwork prep: generate pack from Jira + Confluence",
    },
    {
      time: "45m",
      task: "M365 Copilot: test 4 cheat sheet prompts (if licensed)",
    },
    {
      time: "45m",
      task: "Precision test: AI extraction vs. manual on 1 policy doc",
    },
  ],
  3: [
    {
      time: "45m",
      task: "EU AI Act: classify 3 synthetic AI systems per Annex III",
    },
    {
      time: "60m",
      task: "GDPR: run agent against synthetic DPIA document",
    },
    {
      time: "60m",
      task: "ICFCOP: test 1 mega-control across 3 frameworks",
    },
    {
      time: "45m",
      task: "Vendor Guard: assess 2 synthetic vendor contracts",
    },
    {
      time: "45m",
      task: "Policy extractor: run on synthetic ISO 27001 policy",
    },
    { time: "cont.", task: "Curate regulatory corpus for RAG KB" },
  ],
  4: [
    {
      time: "45m",
      task: "Design audit report template (exec summary, findings, recs)",
    },
    {
      time: "60m",
      task: "3-way match: run P2P matching on synthetic Strapi data",
    },
    {
      time: "60m",
      task: "Generate 3 HTML evidence visualizations from findings",
    },
    {
      time: "60m",
      task: "Generate draft audit report from Track 1 work program",
    },
    { time: "45m", task: "Push 10 findings to Power BI via MCP" },
  ],
  5: [
    {
      time: "90m",
      task: "Set up hallucination detection (claim extract → RAG verify)",
    },
    {
      time: "60m",
      task: "OWASP LLM audit: run 10-control scan on Track 1 agent",
    },
    {
      time: "45m",
      task: "Hallucination check: validate 5 findings from other tracks",
    },
    {
      time: "45m",
      task: "Generate explainability annex for 2 high-risk findings",
    },
    {
      time: "45m",
      task: "Multi-model: same prompt through Claude + local LLM",
    },
  ],
};

export const TABLE_MAPPING: Record<number, { table: number; focus: string }[]> =
  {
    0: [{ table: 1, focus: "Strapi, RAG KB, MCP, SDK" }],
    1: [
      { table: 2, focus: "UC1-UC4 (intake + fraud)" },
      { table: 3, focus: "UC5-UC9 (RCM + work program)" },
    ],
    2: [{ table: 4, focus: "PDF, CLI, access review, M365" }],
    3: [
      { table: 6, focus: "GDPR, EU AI Act" },
      { table: 7, focus: "ICFCOP, vendor guard" },
    ],
    4: [{ table: 8, focus: "Reports, visualizations, Power BI" }],
    5: [{ table: 9, focus: "OWASP, hallucination, explainability" }],
  };

export const ROLES = ["Auditor", "Vaktechniek", "Analyst", "Engineer"] as const;

export const TRACK_OPTIONS = [
  { value: "0", label: "Track 0 — Infrastructure" },
  { value: "1a", label: "Track 1a — GIAS Pipeline (UC1-UC4)" },
  { value: "1b", label: "Track 1b — GIAS Pipeline (UC5-UC9)" },
  { value: "2", label: "Track 2 — Evidence Extraction" },
  { value: "3a", label: "Track 3a — Compliance (GDPR, EU AI Act)" },
  { value: "3b", label: "Track 3b — Compliance (ICFCOP, vendor guard)" },
  { value: "4", label: "Track 4 — Reporting" },
  { value: "5", label: "Track 5 — AI Quality" },
] as const;
