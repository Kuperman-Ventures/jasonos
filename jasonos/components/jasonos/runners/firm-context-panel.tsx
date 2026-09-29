"use client";

import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FirmContext } from "@/lib/server-actions/triage";

const STATUS_LABELS: Record<string, string> = {
  sent: "sent",
  replied: "replied",
  in_conversation: "in conversation",
  live_role: "live role",
};

export function FirmContextPanel({ context }: { context: FirmContext | null }) {
  if (!context) return null;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        Firm context — {context.firm_name}
        <Badge variant="outline" className="ml-auto text-[10px]">
          {context.total_at_firm} contact{context.total_at_firm !== 1 ? "s" : ""}
        </Badge>
      </div>

      {context.already_engaged.length > 0 ? (
        <div>
          <div className="mb-0.5 text-[11px] uppercase tracking-wide text-rung-ink">
            Already engaged
          </div>
          {context.already_engaged.map((peer) => (
            <div key={peer.name} className="text-xs">
              <span className="text-rung-ink">✓</span>{" "}
              <span className="font-medium">{peer.name}</span>
              <span className="text-muted-foreground">
                {" "}— {peer.practice} · {STATUS_LABELS[peer.status] ?? peer.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {context.triaged_not_sent.length > 0 ? (
        <div>
          <div className="mb-0.5 text-[11px] uppercase tracking-wide text-rung-ink">
            Triaged, not sent
          </div>
          {context.triaged_not_sent.map((peer) => (
            <div key={peer.name} className="text-xs">
              <span className="text-rung-ink">●</span>{" "}
              <span className="font-medium">{peer.name}</span>
              <span className="text-muted-foreground">
                {" "}— {peer.practice} · {peer.intent}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {context.untriaged_count > 0 ? (
        <div className="text-xs text-muted-foreground">
          + {context.untriaged_count} other{context.untriaged_count !== 1 ? "s" : ""} at this firm not yet triaged
        </div>
      ) : null}

      <div className="mt-2 rounded border-l-2 border-foreground/40 bg-background/30 px-3 py-2 text-xs italic text-foreground/85">
        {context.strategic_hint}
      </div>
    </div>
  );
}
