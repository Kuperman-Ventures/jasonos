import OversightDashboard from "@/components/projects/oversight-agenda/OversightDashboard";
import { ProjectLinks } from "@/components/jasonos/project-links";
import { project } from "@/lib/projects/oversight-agenda/data";

export const metadata = {
  title: "Oversight Agenda Dashboard · JasonOS",
  description: project.description,
};

export const dynamic = "force-dynamic";

export default function OversightAgendaPage() {
  return (
    <>
      <OversightDashboard />
      <div className="mx-auto max-w-[1200px] overflow-x-clip px-4 pb-8">
        <ProjectLinks slug={project.slug} />
      </div>
    </>
  );
}
