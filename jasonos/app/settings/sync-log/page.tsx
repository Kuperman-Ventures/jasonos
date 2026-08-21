import { ChevronDown, RefreshCw } from "lucide-react";
import {
  getSyncLog,
  groupSyncLog,
  syncLogSourceTitle,
  type SyncLogInstance,
} from "@/lib/outreach/sync-log";
import { APP_TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sync Log · JasonOS" };
export const dynamic = "force-dynamic";

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: APP_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sourceList(instance: SyncLogInstance) {
  return [...new Set(instance.entries.map((row) => syncLogSourceTitle(row.source, row.result)))].join(
    " · "
  );
}

export default async function SyncLogPage() {
  const rows = await getSyncLog();
  const instances = groupSyncLog(rows);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border bg-card p-2 text-sky-300">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Sync Log</h1>
          <p className="text-xs text-muted-foreground">
            Each Sync click is one row. Expand it to see each mailbox,
            Calendar, Beeper, and Suggested from that run.
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-tight">All syncs</h2>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {instances.length}
          </span>
        </div>
        {instances.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No syncs recorded yet. Hit Sync on Networking and they&apos;ll show
            up here.
          </p>
        ) : (
          <ul>
            {instances.map((instance, index) => (
              <li key={instance.id} className="border-b border-border last:border-b-0">
                <details open={index === 0} className="group">
                  <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        instance.hasError
                          ? "bg-red-400"
                          : instance.hasUnavailable
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {fmtWhen(instance.ran_at)}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {sourceList(instance)}
                        {instance.inserted > 0
                          ? ` · +${instance.inserted} new`
                          : ""}
                      </p>
                    </div>
                    <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {instance.entries.length}
                    </span>
                  </summary>
                  <ul className="divide-y divide-border border-t bg-background/40">
                    {instance.entries.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-col gap-1 px-4 py-2.5 pl-14 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-sm leading-snug">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                row.unavailable
                                  ? "bg-amber-400"
                                  : row.ok
                                    ? "bg-emerald-400"
                                    : "bg-red-400"
                              )}
                              aria-hidden
                            />
                            <span className="font-medium">
                              {syncLogSourceTitle(row.source, row.result)}
                            </span>
                          </p>
                          <p className="mt-1 pl-3.5 text-[12px] text-muted-foreground">
                            {row.summary}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
