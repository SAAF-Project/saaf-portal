import ProgressView from "@/components/progress/ProgressView";
import { loadManifests } from "@/lib/visualisations";

// Full-bleed page: the visual needs the whole viewport below the header, not the 1200px content column.
// The visualisations describe themselves in views/<id>/visualization.yaml; they are read here, on the server.
export default function ProgressPage() {
  const visualisations = loadManifests();
  return (
    <div className="relative left-1/2 -my-6 -ml-[50vw] h-[calc(100vh-3.5rem)] w-screen overflow-hidden">
      <ProgressView visualisations={visualisations} />
    </div>
  );
}
