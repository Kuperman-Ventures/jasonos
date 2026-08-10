import { InterviewPrepClient } from "@/components/jasonos/interview-prep/interview-prep-client";
import { listInterviewTargets } from "@/lib/server-actions/interview-prep";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Interview Prep · JasonOS" };

export default async function InterviewPrepPage() {
  const targets = await listInterviewTargets();
  return <InterviewPrepClient targets={targets} />;
}
