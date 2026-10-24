import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { UnattachedSheetClient } from "@/components/jasonos/meeting-prep/call-sheet-client";
import { getCallSheet } from "@/lib/server-actions/call-sheet";
import { getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";
import { getLiveScript } from "@/lib/server-actions/live-scripts";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loaded = await getLiveScript(id);
  return { title: `${loaded.ok ? loaded.script.name : "Sheet"} · Live · JasonOS` };
}

export default async function SheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  const loaded = await getLiveScript(id);
  if (!loaded.ok) {
    if (loaded.error === "Playbook not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground">{loaded.error}</p>
      </div>
    );
  }
  if (loaded.script.kind === "strategy") redirect(`/live/playbooks/${id}`);
  if (loaded.script.attachedPrepId) redirect(`/meetings/${loaded.script.attachedPrepId}`);

  const [sheetResult, meetingsResult] = await Promise.all([
    getCallSheet({ sheetId: id }),
    getUpcomingMeetingPreps(14),
  ]);
  return (
    <UnattachedSheetClient
      sheet={sheetResult.ok ? sheetResult.sheet : null}
      script={loaded.script}
      items={loaded.items}
      meetings={meetingsResult.ok ? meetingsResult.meetings : []}
      initialView={view === "rehearse" ? "rehearse" : "read"}
    />
  );
}
