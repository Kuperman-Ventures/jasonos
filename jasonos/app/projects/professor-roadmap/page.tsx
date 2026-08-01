export const metadata = {
  title: "Professor Roadmap · JasonOS",
  description:
    "Personal operating system for the path to becoming a college professor of marketing, with Seton Hall as the primary target.",
};

/**
 * Renders the Professor Roadmap under the JasonOS TopNav shell.
 * The single-file dashboard lives in public/ and is embedded full-height.
 */
export default function ProfessorRoadmapPage() {
  return (
    <div className="h-[calc(100vh-3rem)] w-full overflow-hidden bg-background">
      <iframe
        title="Marketing Professor Roadmap"
        src="/projects/marketing-professor-roadmap.html"
        className="h-full w-full border-0 bg-background"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
