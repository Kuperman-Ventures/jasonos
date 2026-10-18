import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveScriptClient } from "@/components/jasonos/meeting-prep/live-script-client";
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
  const name = loaded.ok ? loaded.script.name : "Strategy";
  return { title: `${name} · Live · JasonOS` };
}

export default async function LiveScriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [loaded, meetingsResult] = await Promise.all([
    getLiveScript(id),
    getUpcomingMeetingPreps(2),
  ]);
  if (!loaded.ok) {
    if (loaded.error === "Strategy not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground">{loaded.error}</p>
      </div>
    );
  }
  return (
    <LiveScriptClient
      script={loaded.script}
      items={loaded.items}
      meetings={meetingsResult.ok ? meetingsResult.meetings : []}
    />
  );
}
