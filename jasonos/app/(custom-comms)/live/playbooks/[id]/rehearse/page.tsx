import { notFound, redirect } from "next/navigation";
import { RehearseClient } from "@/components/jasonos/meeting-prep/rehearse-client";
import { getLiveScript } from "@/lib/server-actions/live-scripts";

export const dynamic = "force-dynamic";

export default async function RehearsePlaybookPage({
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
  if (loaded.script.kind === "plan") redirect(`/live/sheets/${id}?view=rehearse`);
  if (!loaded.items.some((item) => item.kind !== "agenda")) redirect(`/live/playbooks/${id}`);
  return <RehearseClient script={loaded.script} items={loaded.items} />;
}
