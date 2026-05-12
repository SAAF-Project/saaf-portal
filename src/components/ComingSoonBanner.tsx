export default function ComingSoonBanner({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-8 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 rounded-full text-accent text-xs font-semibold mb-4">
        Coming soon
      </div>
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-muted text-sm max-w-md mx-auto">{description}</p>
    </div>
  );
}
