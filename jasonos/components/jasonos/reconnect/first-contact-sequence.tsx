"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  advanceFirstContactStage,
  generateFirstContactDraft,
} from "@/lib/server-actions/first-contact";
import type {
  FirstContactDraftStage,
  FirstContactStage,
  FirstContactState,
} from "@/lib/first-contact/types";
import { cn } from "@/lib/utils";

const SEQUENCE: FirstContactStage[] = [
  "identified",
  "connect_sent",
  "connect_accepted",
  "dm_sent",
  "dm_replied",
  "email_sent",
  "email_replied",
  "meeting_scheduled",
];

const STAGE_LABEL: Record<FirstContactStage, string> = {
  identified: "Identified",
  connect_sent: "Connect sent",
  connect_accepted: "Accepted",
  dm_sent: "DM sent",
  dm_replied: "DM replied",
  email_sent: "Email sent",
  email_replied: "Email replied",
  meeting_scheduled: "Meeting scheduled",
  completed: "Completed",
  closed_no_response: "Closed no response",
};

const DRAFT_STAGE: Partial<Record<FirstContactStage, FirstContactDraftStage>> = {
  identified: "connect_request",
  connect_accepted: "linkedin_dm",
  dm_replied: "email_followup",
};

const DRAFT_CTA: Record<FirstContactDraftStage, string> = {
  connect_request: "Generate connection request",
  linkedin_dm: "Generate post-accept DM",
  email_followup: "Generate email follow-up",
};

const SENT_STAGE: Record<FirstContactDraftStage, FirstContactStage> = {
  connect_request: "connect_sent",
  linkedin_dm: "dm_sent",
  email_followup: "email_sent",
};

interface Props {
  contactId: string;
  contactName: string;
  state: FirstContactState;
  onAdvance: (newState: FirstContactState) => void;
}

export function FirstContactSequence({
  contactId,
  contactName,
  state,
  onAdvance,
}: Props) {
  const [draft, setDraft] = useState("");
  const [rationale, setRationale] = useState("");
  const [isPending, startTransition] = useTransition();
  const draftStage = DRAFT_STAGE[state.stage];
  const stageIndex = Math.max(0, SEQUENCE.indexOf(state.stage));
  const charLimit = draftStage === "connect_request" ? 300 : null;
  const overLimit = Boolean(charLimit && draft.length > charLimit);

  const generate = () => {
    if (!draftStage) return;
    startTransition(async () => {
      const result = await generateFirstContactDraft({ contactId, stage: draftStage });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraft(result.draft);
      setRationale(result.rationale);
      toast.success("First contact draft generated");
    });
  };

  const advance = (newStage: FirstContactStage, note?: string, sentDraft = draft) => {
    startTransition(async () => {
      const result = await advanceFirstContactStage({
        contactId,
        newStage,
        draft: sentDraft.trim() || undefined,
        note,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.state) onAdvance(result.state);
      setDraft("");
      setRationale("");
      toast.success(`First Contact: ${STAGE_LABEL[newStage]}`);
    });
  };

  const copy = async () => {
    if (!draft.trim()) return false;
    await navigator.clipboard.writeText(draft.trim());
    toast.success("Copied to clipboard");
    return true;
  };

  const copyAndMarkSent = async () => {
    if (!draftStage || !(await copy())) return;
    advance(SENT_STAGE[draftStage]);
  };

  return (
    <section id="first-contact-sequence" className="rounded-xl border bg-background/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">First Contact Sequence</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {contactName} · {describeStage(state.stage)}
          </p>
        </div>
        <Badge variant="outline">
          Stage {state.stage === "completed" || state.stage === "closed_no_response" ? 8 : stageIndex + 1} of 8
        </Badge>
      </div>

      <div className="mt-3 flex items-center gap-1.5" aria-label="First contact progress">
        {SEQUENCE.map((stage, index) => (
          <span
            key={stage}
            className={cn(
              "h-2.5 w-2.5 rounded-full border",
              index <= stageIndex || state.stage === "completed"
                ? "border-[var(--jos-line)] bg-rung-2"
                : "border-muted-foreground/40"
            )}
          />
        ))}
      </div>

      {draftStage ? (
        <div className="mt-4 space-y-3">
          <Button onClick={generate} disabled={isPending} size="sm" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {isPending ? "Generating..." : DRAFT_CTA[draftStage]}
          </Button>

          {draft ? (
            <>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={draftStage === "email_followup" ? 12 : 7}
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {charLimit ? (
                  <span className={overLimit ? "text-rung-1" : ""}>
                    {draft.length} / {charLimit} chars
                  </span>
                ) : null}
                {rationale ? <span>{rationale}</span> : null}
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => void copy()}>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
                <Button size="sm" onClick={() => void copyAndMarkSent()} disabled={overLimit}>
                  Copy & mark sent
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <StageActions stage={state.stage} isPending={isPending} onAdvance={advance} />
      )}

      {state.history.length ? (
        <details className="mt-4 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground/80">History</summary>
          <div className="mt-2 space-y-2">
            {state.history.map((event, index) => (
              <div key={`${event.stage}-${event.at}-${index}`} className="rounded-md border p-2">
                <div className="font-medium">{STAGE_LABEL[event.stage]}</div>
                <div>{new Date(event.at).toLocaleString()}</div>
                {event.note ? <div className="mt-1">{event.note}</div> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function StageActions({
  stage,
  isPending,
  onAdvance,
}: {
  stage: FirstContactStage;
  isPending: boolean;
  onAdvance: (stage: FirstContactStage, note?: string, draft?: string) => void;
}) {
  if (stage === "completed") {
    return (
      <div className="mt-4 flex items-center gap-2 text-sm text-rung-ink">
        <CheckCircle2 className="h-4 w-4" />
        First contact complete
      </div>
    );
  }

  if (stage === "closed_no_response") {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-sm text-muted-foreground">Closed - no response after this attempt.</p>
        <Button size="sm" variant="outline" onClick={() => onAdvance("identified", "Reset sequence")} disabled={isPending}>
          Try again
        </Button>
      </div>
    );
  }

  const actions = getActions(stage);
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">{waitingHint(stage)}</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.stage}
            size="sm"
            variant={action.variant ?? "outline"}
            onClick={() => onAdvance(action.stage, action.note)}
            disabled={isPending}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function getActions(stage: FirstContactStage): Array<{
  label: string;
  stage: FirstContactStage;
  note?: string;
  variant?: "default" | "outline" | "destructive";
}> {
  switch (stage) {
    case "connect_sent":
      return [
        { label: "Mark accepted", stage: "connect_accepted", variant: "default" },
        { label: "Mark no response", stage: "closed_no_response", note: "No response to connection request" },
      ];
    case "dm_sent":
      return [
        { label: "Mark replied", stage: "dm_replied", variant: "default" },
        { label: "Mark no response", stage: "closed_no_response", note: "No response to LinkedIn DM" },
      ];
    case "email_sent":
      return [
        { label: "Mark replied", stage: "email_replied", variant: "default" },
        { label: "Mark no response", stage: "closed_no_response", note: "No response to email follow-up" },
        { label: "Mark meeting scheduled", stage: "meeting_scheduled" },
      ];
    case "email_replied":
      return [
        { label: "Mark meeting scheduled", stage: "meeting_scheduled", variant: "default" },
        { label: "Continue conversation", stage: "completed" },
      ];
    case "meeting_scheduled":
      return [
        { label: "Mark completed", stage: "completed", variant: "default" },
        { label: "Mark cancelled", stage: "closed_no_response" },
      ];
    default:
      return [];
  }
}

function describeStage(stage: FirstContactStage) {
  switch (stage) {
    case "identified":
      return "Draft connection request";
    case "connect_sent":
      return "Awaiting acceptance";
    case "connect_accepted":
      return "Draft post-accept DM";
    case "dm_sent":
      return "Awaiting DM reply";
    case "dm_replied":
      return "Draft email follow-up";
    case "email_sent":
      return "Awaiting email reply";
    case "email_replied":
      return "Schedule meeting";
    case "meeting_scheduled":
      return "Meeting on calendar";
    case "completed":
      return "Complete";
    case "closed_no_response":
      return "Closed - no response";
  }
}

function waitingHint(stage: FirstContactStage) {
  switch (stage) {
    case "connect_sent":
      return "Awaiting acceptance. Check back in 7 days.";
    case "dm_sent":
      return "Awaiting DM reply. Check back in 5 days.";
    case "email_sent":
      return "Awaiting email reply.";
    default:
      return describeStage(stage);
  }
}
