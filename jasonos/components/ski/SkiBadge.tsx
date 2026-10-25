export function SkiBadge({
  ground,
  className = "size-9",
}: {
  ground: "light" | "dark";
  className?: string;
}) {
  const onLight = ground === "light";
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <circle cx="60" cy="60" r="58" fill={onLight ? "#0b1d33" : "#f4f8fb"} />
      <polygon points="14,92 50,34 66,58 78,42 106,92" fill={onLight ? "#d6eaf7" : "#1f6fd1"} />
      {onLight ? null : <polygon points="50,34 39,52 46,48 52,56 59,48 66,58" fill="#f4f8fb" />}
      <circle cx="92" cy="30" r="8" fill="#ff5a1f" />
    </svg>
  );
}
