import { PostMasterApp } from "@/components/post-master/PostMasterApp";
import { listPostMasterProjects } from "@/lib/server-actions/post-master";
import { listWeeklyProvocations } from "@/lib/server-actions/weekly-provocation";

export const dynamic = "force-dynamic";

export default async function PostMasterPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const params = await searchParams;
  const moduleName =
    params.module === "weekly-provocation" ? "provocation" : "posts";
  const [initialProjects, provocations] = await Promise.all([
    listPostMasterProjects(),
    listWeeklyProvocations(),
  ]);
  return (
    <PostMasterApp
      initialProjects={initialProjects}
      module={moduleName}
      provocations={provocations}
    />
  );
}
