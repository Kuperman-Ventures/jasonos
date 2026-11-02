import { ScrollText } from "lucide-react";
import { getActionLog } from "@/lib/actions/action-log";
import { getUpcoming } from "@/lib/actions/upcoming";
import { etToday } from "@/lib/dates";
import { ActionLogClient } from "@/components/jasonos/settings/action-log-client";

export const metadata = { title: "Action Log · JasonOS" };
export const dynamic = "force-dynamic";

const LIMIT = 500;

export default async function ActionLogPage() {
  const [rows, upcoming] = await Promise.all([getActionLog(LIMIT), getUpcoming()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border bg-card p-2 text-rung-3">
          <ScrollText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Action Log</h1>
          <p className="text-xs text-muted-foreground">
            Coming up is everything you snoozed or set for a later day.
            What you did is the history under that. Sync that clears a row
            because you already emailed someone is not listed.
          </p>
        </div>
      </header>
      <ActionLogClient
        rows={rows}
        upcoming={upcoming}
        today={etToday()}
        capped={rows.length >= LIMIT}
      />
    </div>
  );
}
