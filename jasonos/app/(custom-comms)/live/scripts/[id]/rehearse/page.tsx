import { notFound, redirect } from "next/navigation";
import { getLiveScript } from "@/lib/server-actions/live-scripts";

export const dynamic = "force-dynamic";

export default async function RehearseScriptRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await getLiveScript(id);
  if (!loaded.ok) notFound();
  redirect(
    loaded.script.kind === "strategy" ? `/live/playbooks/${id}/rehearse` : `/live/sheets/${id}?view=rehearse`
  );
}
