import { ProfessorRoadmap } from "@/components/jasonos/professor-roadmap/professor-roadmap";
import { ProjectLinks } from "@/components/jasonos/project-links";
import { getProfessorRoadmap } from "@/lib/professor-roadmap/store";

export const metadata = {
  title: "Professor Roadmap · JasonOS",
  description:
    "Research and next steps for the path to teaching marketing, Seton Hall first.",
};

export const dynamic = "force-dynamic";

export default async function ProfessorRoadmapPage() {
  const data = await getProfessorRoadmap();

  return (
    <>
      <ProfessorRoadmap data={data} />
      <div className="mx-auto max-w-[960px] px-4 pb-8">
        <ProjectLinks slug="professor-roadmap" />
      </div>
    </>
  );
}
