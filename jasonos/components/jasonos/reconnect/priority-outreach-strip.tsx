"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  computePriorityFunnel,
  FUNNEL_LABELS,
  type FunnelStage,
} from "@/lib/reconnect/priority";
import type { ReconnectContact } from "@/lib/reconnect/types";

const STAGES: FunnelStage[] = ["not_contacted", "contacted", "replied", "meeting"];

const BAR_COLORS: Record<FunnelStage, string> = {
  not_contacted: "bg-muted",
  contacted: "bg-rung-3",
  replied: "bg-rung-ok",
  meeting: "bg-rung-idle",
  closed: "bg-slate-500/40",
};

export function PriorityOutreachStrip({
  contacts,
  selectedStage,
  onSelectStage,
  onSelectContact,
}: {
  contacts: ReconnectContact[];
  selectedStage: FunnelStage | null;
  onSelectStage: (stage: FunnelStage) => void;
  onSelectContact: (id: string) => void;
}) {
  const stats = useMemo(() => computePriorityFunnel(contacts), [contacts]);
  const [showNotContacted, setShowNotContacted] = useState(false);
  const [showAwaiting, setShowAwaiting] = useState(false);

  if (stats.total === 0) {
    return (
      <Card size="sm" className="border-dashed">
        <CardContent className="text-sm text-muted-foreground">
          No priority outreach contacts yet. Triage contacts as <em>door</em>,{" "}
          <em>pipeline</em>, or <em>role inquiry</em>, or import contacts with
          strategic score at 80+.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/80">
      <CardContent className="space-y-3 p-4">
        <header className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Priority outreach
            </div>
            <div className="text-sm text-muted-foreground">
              {stats.total} contacts · strategic score 80+ or active intent
            </div>
          </div>
        </header>

        <div className="space-y-1.5">
          {STAGES.map((stage) => {
            const count = stats.byStage[stage];
            const pct = stats.total ? (count / stats.total) * 100 : 0;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => onSelectStage(stage)}
                className={cn(
                  "grid w-full grid-cols-[110px_minmax(0,1fr)_60px] items-center gap-3 rounded-md px-1 py-0.5 text-left hover:bg-muted/40",
                  selectedStage === stage && "bg-muted/50"
                )}
              >
                <div className="text-xs">{FUNNEL_LABELS[stage]}</div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                  <div
                    className={cn("h-full transition-all", BAR_COLORS[stage])}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-right text-xs tabular-nums">
                  <span className="font-semibold">{count}</span>
                  <span className="text-muted-foreground"> · {Math.round(pct)}%</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {stats.notContactedContacts.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNotContacted((current) => !current)}
            >
              Not yet contacted ({stats.notContactedContacts.length})
              <ChevronRight
                className={cn(
                  "ml-1 h-3 w-3 transition-transform",
                  showNotContacted && "rotate-90"
                )}
              />
            </Button>
          ) : null}
          {stats.awaitingReplyContacts.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAwaiting((current) => !current)}
            >
              Awaiting reply &gt;5d ({stats.awaitingReplyContacts.length})
              <ChevronRight
                className={cn("ml-1 h-3 w-3 transition-transform", showAwaiting && "rotate-90")}
              />
            </Button>
          ) : null}
        </div>

        {showNotContacted ? (
          <ContactList
            title="Send next:"
            contacts={stats.notContactedContacts}
            onSelectContact={onSelectContact}
            showScore
          />
        ) : null}

        {showAwaiting ? (
          <ContactList
            title="Follow up overdue:"
            contacts={stats.awaitingReplyContacts}
            onSelectContact={onSelectContact}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function ContactList({
  title,
  contacts,
  onSelectContact,
  showScore,
}: {
  title: string;
  contacts: ReconnectContact[];
  onSelectContact: (id: string) => void;
  showScore?: boolean;
}) {
  return (
    <div className="rounded-md border bg-background/30 p-2">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-1">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <button
              type="button"
              onClick={() => onSelectContact(contact.id)}
              className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted/40"
            >
              <span className="font-medium">{contact.name}</span>
              <span className="text-muted-foreground"> · {contact.firm}</span>
              {showScore ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  strat {contact.strategic_score}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
