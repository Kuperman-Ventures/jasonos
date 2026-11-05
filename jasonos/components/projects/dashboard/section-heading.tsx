export function SectionHeading({
  children,
  className = "mb-3",
}: {
  children: string;
  className?: string;
}) {
  return (
    <h2
      className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${className}`}
    >
      {children}
    </h2>
  );
}
