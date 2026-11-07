import ProgressView from "@/components/progress/ProgressView";

// Full-bleed page: the visual needs the whole viewport below the header, not the 1200px content column.
export default function ProgressPage() {
  return (
    <div className="relative left-1/2 -my-6 -ml-[50vw] h-[calc(100vh-3.5rem)] w-screen overflow-hidden">
      <ProgressView />
    </div>
  );
}
