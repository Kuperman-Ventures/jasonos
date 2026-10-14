import { PostMasterApp } from "@/components/post-master/PostMasterApp";
import { listPostMasterProjects } from "@/lib/server-actions/post-master";

export const dynamic = "force-dynamic";

export default async function PostMasterPage() {
  const initialProjects = await listPostMasterProjects();
  return <PostMasterApp initialProjects={initialProjects} />;
}
