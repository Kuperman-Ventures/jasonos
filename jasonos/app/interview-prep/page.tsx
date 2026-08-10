import { InterviewPrepClient } from "@/components/jasonos/interview-prep/interview-prep-client";
import {
  getSavedInterviewPrep,
  listInterviewTargets,
} from "@/lib/server-actions/interview-prep";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Interview Prep · JasonOS" };

export default async function InterviewPrepPage() {
  const targets = await listInterviewTargets();
  const first = targets[0];
  let initialSaved = null;
  if (first?.hasSavedPrep) {
    const res = await getSavedInterviewPrep({ customizationId: first.id });
    if (res.ok) initialSaved = res.saved;
  }
  return (
    <InterviewPrepClient targets={targets} initialSaved={initialSaved} />
  );
}
