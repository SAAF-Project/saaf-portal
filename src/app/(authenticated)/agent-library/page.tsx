import ComingSoonBanner from "@/components/ComingSoonBanner";

export default function AgentLibraryPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">Agent Library</h1>
      <ComingSoonBanner
        title="AI Audit Agents"
        description="Browse and discover AI audit agents built by the SAAF community. Search by domain, framework, or use case."
      />
      <div className="mt-4 p-4 bg-saaf-yellow/5 border border-saaf-yellow/20 rounded-xl text-xs text-muted leading-relaxed">
        <p className="text-saaf-yellow font-semibold mb-1">Disclaimer</p>
        <p>
          We cannot provide assurance on the AI agents in this repository — AI
          LLMs can hallucinate and we have not yet completed the red-teaming
          (hack the agents) phase. Agents are shared as-is for research and
          collaboration purposes only.
        </p>
      </div>
    </div>
  );
}
