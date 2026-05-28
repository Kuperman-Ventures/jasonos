"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Star, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BROWNING_DELIVERED_STATUS_LABELS,
  type BrowningDeliverable,
} from "@/lib/browning/types";
import {
  DELIVERED_STATUS_TONE,
  fmtBrowningDate,
} from "@/lib/browning/format";
import { DeliverableDialog } from "@/components/jasonos/browning/deliverable-dialog";
import { upsertDeliverable } from "@/lib/server-actions/browning";

interface Props {
  deliverables: BrowningDeliverable[];
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function fmtMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function WatchPanel({ deliverables }: Props) {
  const [editing, setEditing] = useState<BrowningDeliverable | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, BrowningDeliverable[]>();
    for (const d of deliverables) {
      const key = monthKey(d.month);
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [deliverables]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Browning Watch</h3>
          <p className="text-[11px] text-muted-foreground">
            What Browning promised vs. what they delivered. Escalate the gaps.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Log deliverable
        </Button>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No deliverables logged yet. Use{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => setAddOpen(true)}
          >
            Log deliverable
          </button>{" "}
          to record what Browning promised this month.
        </div>
      ) : (
        grouped.map(([month, items]) => (
          <section key={month} className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {fmtMonth(`${month}-01`)}
            </h4>
            <div className="overflow-hidden rounded-lg border bg-card/40">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Promised</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">On time</th>
                    <th className="px-3 py-2 text-left">Quality</th>
                    <th className="px-3 py-2 text-left">Notes</th>
                    <th className="px-3 py-2 text-right">Escalate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((d) => (
                    <DeliverableRow
                      key={d.id}
                      deliverable={d}
                      onClick={() => setEditing(d)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      <DeliverableDialog
        open={!!editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        deliverable={editing}
      />
      <DeliverableDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        deliverable={null}
      />
    </div>
  );
}

function DeliverableRow({
  deliverable,
  onClick,
}: {
  deliverable: BrowningDeliverable;
  onClick: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const status = deliverable.delivered_status;

  const toggleEscalate = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const result = await upsertDeliverable({
        id: deliverable.id,
        month: deliverable.month,
        promised: deliverable.promised,
        deliveredStatus: deliverable.delivered_status,
        onTime: deliverable.on_time,
        quality: deliverable.quality,
        notes: deliverable.notes ?? "",
        escalate: !deliverable.escalate,
      });
      if (!result.ok) toast.error(result.error);
    });
  };

  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-muted/30"
      onClick={onClick}
    >
      <td className="max-w-[280px] px-3 py-2 align-top">
        <div className="line-clamp-2 font-medium">{deliverable.promised}</div>
      </td>
      <td className="px-3 py-2 align-top">
        {status ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]",
              DELIVERED_STATUS_TONE[status]
            )}
          >
            {BROWNING_DELIVERED_STATUS_LABELS[status]}
          </span>
        ) : (
          <Badge variant="outline">Pending</Badge>
        )}
      </td>
      <td className="px-3 py-2 align-top text-muted-foreground">
        {deliverable.on_time === null
          ? "—"
          : deliverable.on_time
          ? "Yes"
          : "No"}
      </td>
      <td className="px-3 py-2 align-top">
        {deliverable.quality !== null ? (
          <span className="inline-flex items-center gap-0.5 text-amber-300">
            {Array.from({ length: deliverable.quality }).map((_, i) => (
              <Star key={i} className="h-3 w-3 fill-amber-300" />
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 align-top text-muted-foreground">
        <div className="line-clamp-2">{deliverable.notes ?? "—"}</div>
        <div className="text-[10px] text-muted-foreground/70">
          {fmtBrowningDate(deliverable.month)}
        </div>
      </td>
      <td className="px-3 py-2 align-top text-right">
        <button
          type="button"
          onClick={toggleEscalate}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
            deliverable.escalate
              ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {deliverable.escalate ? "Escalated" : "Escalate"}
        </button>
      </td>
    </tr>
  );
}
