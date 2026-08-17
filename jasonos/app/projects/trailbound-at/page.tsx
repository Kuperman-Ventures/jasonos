export const metadata = {
  title: "Trailbound AT · JasonOS",
  description:
    "Adaptive Appalachian Trail readiness planner. See the whole mountain. Work the next blaze.",
};

/**
 * Renders Trailbound AT under the JasonOS TopNav shell.
 * The local-first SPA lives in public/ and is embedded full-height.
 */
export default function TrailboundAtPage() {
  return (
    <div className="h-[calc(100vh-3rem)] w-full overflow-hidden bg-background">
      <iframe
        title="Trailbound AT"
        src="/projects/trailbound-at.html"
        className="h-full w-full border-0 bg-background"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
