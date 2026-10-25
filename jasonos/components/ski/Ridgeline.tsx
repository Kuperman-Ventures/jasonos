export function Ridgeline({ tone }: { tone: "light" | "dark" }) {
  if (tone === "dark") {
    return (
      <svg
        viewBox="0 0 1360 420"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-0 top-0 h-[420px] w-full"
        aria-hidden
      >
        <polygon points="0,420 0,300 180,190 300,260 520,110 700,240 900,140 1100,250 1360,170 1360,420" fill="#12304f" />
        <polygon points="0,420 0,350 240,280 420,340 640,250 860,340 1100,290 1360,340 1360,420" fill="#0f2742" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 390 200"
      preserveAspectRatio="none"
      className="pointer-events-none absolute bottom-0 left-0 h-[170px] w-full"
      aria-hidden
    >
      <polygon points="0,200 0,110 60,70 100,100 170,30 250,110 310,70 390,120 390,200" fill="#d6eaf7" />
      <polygon points="0,200 0,160 90,120 160,150 240,110 320,150 390,130 390,200" fill="#a9cfe8" />
    </svg>
  );
}
