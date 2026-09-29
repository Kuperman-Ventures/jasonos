"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Moon, Reply, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AskDispatchButton } from "@/components/dispatch/AskDispatchButton";
import { markReconnectReplied, markReconnectSent, snoozeReconnectContact } from "@/app/actions/reconnect";
import type { ReconnectContact, RecruiterStatus } from "@/lib/reconnect/types";
import { TierBadge } from "./tier-badge";
import { ScoreChip } from "./score-chip";
import { IntentBadge } from "./intent-badge";
import { FocusBadge } from "./focus-badge";

export function ReconnectQueueCard({
  contact,
  onOpen,
  onStatus,
}: {
  contact: ReconnectContact;
  onOpen: (contact: ReconnectContact) => void;
  onStatus: (id: string, status: RecruiterStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const run = (
    label: string,
    status: RecruiterStatus,
    action: () => Promise<{ ok: boolean; message?: string }>
  ) => {
    onStatus(contact.id, status);
    startTransition(async () => {
      const result = await action();
      toast[result.ok ? "success" : "error"](
        result.ok ? label : result.message || "Reconnect action failed"
      );
    });
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(contact)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(contact);
      }}
      className="group rounded-xl border bg-card p-4 text-left transition-colors hover:border-[var(--jos-line)] hover:bg-card/90"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TierBadge tier={contact.tier} />
            <FocusBadge rank={contact.firm_focus_rank} />
            <IntentBadge intent={contact.intent} personalGoal={contact.personal_goal} />
            <ScoreChip score={contact.strategic_score} />
            {contact.specialty ? (
              <span className="rounded-full border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                {contact.specialty}
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-tight">{contact.name}</h2>
          <p className="text-sm text-muted-foreground">{contact.firm}</p>
          {contact.personal_goal ? (
            <p className="mt-1.5 text-xs italic text-foreground/75">
              &ldquo;{contact.personal_goal}&rdquo;
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(contact);
          }}
          aria-label={`Open ${contact.name}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3">
        <p className={expanded ? "text-sm leading-relaxed" : "line-clamp-2 text-sm leading-relaxed"}>
          {contact.strategic_recommended_approach}
        </p>
        {contact.strategic_recommended_approach.length > 150 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="mt-1 text-xs font-medium text-rung-ink hover:text-rung-ink"
          >
            {expanded ? "less" : "more"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-auto text-xs text-muted-foreground">
          {contact.last_contact_date ? (
            <>
              Last contact:{" "}
              {formatDistanceToNow(new Date(contact.last_contact_date), { addSuffix: true })}
              {contact.touches[0]?.channel ? (
                <> · via {channelLabel(contact.touches[0].channel)}</>
              ) : null}
            </>
          ) : (
            "No contact yet"
          )}
        </span>
        <AskDispatchButton
          requestType="outreach_draft"
          sourcePage="/reconnect"
          context={{
            contact_id: contact.id,
            name: contact.name,
            purpose: contact.strategic_recommended_approach,
            previous_outreach_summary:
              contact.summary_of_prior_comms ?? contact.outlook_history ?? null,
          }}
          label="Ask Dispatch"
        />
        <Button
          size="sm"
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation();
            run("Marked sent", "sent", () => markReconnectSent(contact.id));
          }}
          className="gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          Sent
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation();
            run("Marked reply", "replied", () => markReconnectReplied(contact.id));
          }}
          className="gap-1.5"
        >
          <Reply className="h-3.5 w-3.5" />
          Got reply
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation();
            run("Snoozed 7 days", "snoozed", () => snoozeReconnectContact(contact.id));
          }}
          className="gap-1.5"
        >
          <Moon className="h-3.5 w-3.5" />
          Snooze 7d
        </Button>
      </div>
    </article>
  );
}

function channelLabel(channel: string): string {
  const map: Record<string, string> = {
    email: "email",
    linkedin: "LinkedIn",
    phone: "phone",
    meeting: "meeting",
    event: "event",
    referral: "referral",
    other: "other",
  };
  return map[channel] ?? channel;
}
