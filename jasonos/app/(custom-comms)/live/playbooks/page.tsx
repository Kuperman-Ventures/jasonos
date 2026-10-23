import type { Metadata } from "next";
import { PlaybooksIndexClient } from "@/components/jasonos/meeting-prep/playbooks-index-client";
import { listPlaybookQuestions, listPlaybooks } from "@/lib/server-actions/live-scripts";

export const metadata: Metadata = { title: "Playbooks · Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LivePlaybooksPage() {
  const [result, questionsResult] = await Promise.all([listPlaybooks(), listPlaybookQuestions()]);
  return (
    <PlaybooksIndexClient
      playbooks={result.ok ? result.playbooks : []}
      questions={questionsResult.ok ? questionsResult.questions : []}
      error={result.ok ? null : result.error}
    />
  );
}
