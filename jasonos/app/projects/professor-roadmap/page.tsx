export const metadata = {
  title: "Professor Roadmap · JasonOS",
  description:
    "Personal operating system for the path to becoming a college professor of marketing, with Seton Hall as the primary target.",
};

export default function ProfessorRoadmapPage() {
  return (
    <div className="h-[calc(100vh-3rem)] w-full overflow-hidden bg-background">
      <iframe
        title="Marketing Professor Roadmap"
        src="/projects/marketing-professor-roadmap.html"
        className="h-full w-full border-0 bg-background"
      />
    </div>
  );
}
