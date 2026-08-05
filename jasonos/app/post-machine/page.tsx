import { PostMachineApp } from "@/components/post-machine/PostMachineApp";
import { listPostMachineProjects } from "@/lib/server-actions/post-machine";

export const dynamic = "force-dynamic";

export default async function PostMachinePage() {
  const initialProjects = await listPostMachineProjects();
  return <PostMachineApp initialProjects={initialProjects} />;
}
