import { ScrollText } from "lucide-react";
import { getActionLog } from "@/lib/actions/action-log";
import { ActionLogClient } from "@/components/jasonos/settings/action-log-client";

export const metadata = { title: "Action Log · JasonOS" };
export const dynamic = "force-dynamic";

const LIMIT = 500;

export default async function ActionLogPage() {
  const rows = await getActionLog(LIMIT);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border bg-card p-2 text-rung-3">
          <ScrollText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Action Log</h1>
          <p className="text-xs text-muted-foreground">
            Snooze, skip, done, and dismiss on follow-ups, commitments, and
            queues. Sync that clears a row because you already emailed someone
            is not listed. Open snoozes, scheduled email follow-ups, and
            commitment marks from before this page existed are included.
          </p>
        </div>
      </header>
      <ActionLogClient rows={rows} capped={rows.length >= LIMIT} />
    </div>
  );
}
