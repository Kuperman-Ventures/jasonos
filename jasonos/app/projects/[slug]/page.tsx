import { ProjectLinks } from "@/components/jasonos/project-links";
import { ProjectDashboard } from "@/components/projects/dashboard/ProjectDashboard";
import { getProjectPage, readProjectDashboard } from "@/lib/dashboard/store";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectPage(slug);
  if (!project) return { title: "Project · JasonOS" };
  return {
    title: `${project.title} · JasonOS`,
    description: project.description ?? undefined,
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectPage(slug);
  if (!project) notFound();
  const dashboard = await readProjectDashboard(slug);

  return (
    <>
      {dashboard ? <ProjectDashboard document={dashboard} /> : null}
      <div className="mx-auto min-w-0 max-w-[1200px] overflow-x-clip px-4 pb-16">
        {dashboard ? null : (
          <header className="py-6">
            <h1 className="text-xl font-semibold tracking-tight">{project.title}</h1>
            {project.description ? (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            ) : null}
          </header>
        )}
        <ProjectLinks slug={project.slug} />
      </div>
    </>
  );
}
