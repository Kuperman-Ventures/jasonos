import OversightDashboard from "@/components/projects/oversight-agenda/OversightDashboard";
import { ProjectLinks } from "@/components/jasonos/project-links";
import { news, project, timeline } from "@/lib/projects/oversight-agenda/data";
import { decorateNews, decorateTimeline } from "@/lib/projects/oversight-agenda/view";

export const metadata = {
  title: "Oversight Agenda Dashboard · JasonOS",
  description: project.description,
};

export const dynamic = "force-dynamic";

export default function OversightAgendaPage() {
  const now = new Date();
  return (
    <>
      <OversightDashboard news={decorateNews(news, now)} timeline={decorateTimeline(timeline, now)} />
      <div className="mx-auto max-w-[1280px] overflow-x-clip px-[clamp(16px,4vw,48px)] pb-16">
        <ProjectLinks slug={project.slug} />
      </div>
    </>
  );
}
