import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveScriptClient } from "@/components/jasonos/meeting-prep/live-script-client";
import { getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";
import { getLiveScript, listMeetingsUsingScript } from "@/lib/server-actions/live-scripts";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loaded = await getLiveScript(id);
  const fallback = loaded.ok ? (loaded.script.kind === "plan" ? "Guide" : "Playbook") : "Playbook";
  const name = loaded.ok ? loaded.script.name : fallback;
  return { title: `${name} · Live · JasonOS` };
}

export default async function LiveScriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await getLiveScript(id);
  if (!loaded.ok) {
    if (loaded.error === "Playbook not found." || loaded.error === "Strategy not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground">{loaded.error}</p>
      </div>
    );
  }
  const isPlan = loaded.script.kind === "plan";
  const [meetingsResult, usedOnResult] = await Promise.all([
    isPlan ? getUpcomingMeetingPreps(14) : Promise.resolve({ ok: true as const, meetings: [] }),
    isPlan
      ? Promise.resolve({ ok: true as const, meetings: [] })
      : listMeetingsUsingScript(id, 5),
  ]);
  return (
    <LiveScriptClient
      script={loaded.script}
      items={loaded.items}
      meetings={meetingsResult.ok ? meetingsResult.meetings : []}
      usedOn={usedOnResult.ok ? usedOnResult.meetings : []}
    />
  );
}
