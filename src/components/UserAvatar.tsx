export default function UserAvatar({
  src,
  alt,
  size = 48,
  className = "",
}: {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`rounded-full bg-surface2 border border-border flex items-center justify-center text-muted font-bold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {alt?.charAt(0)?.toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ""}
      width={size}
      height={size}
      className={`rounded-full border-2 border-border ${className}`}
    />
  );
}
