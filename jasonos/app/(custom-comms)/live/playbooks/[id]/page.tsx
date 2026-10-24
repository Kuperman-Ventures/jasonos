import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlaybookClient } from "@/components/jasonos/meeting-prep/playbook-client";
import {
  getLiveScript,
  listMeetingsUsingScript,
  listPlaybookQuestions,
} from "@/lib/server-actions/live-scripts";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loaded = await getLiveScript(id);
  return { title: `${loaded.ok ? loaded.script.name : "Playbook"} · Live · JasonOS` };
}

export default async function PlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await getLiveScript(id);
  if (!loaded.ok) {
    if (loaded.error === "Playbook not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground">{loaded.error}</p>
      </div>
    );
  }
  if (loaded.script.kind === "plan") redirect(`/live/sheets/${id}`);

  const [questionsResult, usedOnResult] = await Promise.all([
    listPlaybookQuestions(id),
    listMeetingsUsingScript(id, 5),
  ]);
  return (
    <PlaybookClient
      script={loaded.script}
      items={loaded.items}
      questions={questionsResult.ok ? questionsResult.questions : []}
      usedOn={usedOnResult.ok ? usedOnResult.meetings : []}
    />
  );
}
