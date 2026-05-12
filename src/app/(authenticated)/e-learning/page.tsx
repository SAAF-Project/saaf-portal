import ComingSoonBanner from "@/components/ComingSoonBanner";

export default function ELearningPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">E-Learning</h1>
      <ComingSoonBanner
        title="Learning Modules"
        description="Interactive learning modules for AI audit agent development are coming soon. Build your skills in prompts, tools, regulatory frameworks, and output quality."
      />
    </div>
  );
}
