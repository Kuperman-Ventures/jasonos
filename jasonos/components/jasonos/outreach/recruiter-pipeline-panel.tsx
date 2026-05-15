"use client";

// RecruiterPipelinePanel — extracted from the legacy ReconnectDetailModal.
// Renders the recruiter-pipeline-specific sections inside OutreachModal
// when the contact has an active recruiter pipeline record.
//
// Two exported pieces:
//   - <RecruiterPipelineActions />  → header action buttons (TierBadge,
//     Send to Triage, AskDispatch x2, HubSpot link, etc.)
//   - <RecruiterPipelinePanel />    → body sections (Strategic Rec,
//     Quick Actions, Intent picker, FirstContactSequence, Score
//     Breakdown, Communication Context, Notes Timeline, Firmmates)

import { useEffect, useState, useTransition } from "react";
import {
  Copy,
  ExternalLink,
  Inbox,
  MessageSquareText,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AskDispatchButton } from "@/components/dispatch/AskDispatchButton";
import { addReconnectNote, setReconnectStatus } from "@/app/actions/reconnect";
import { getFirmmates, type Firmmate } from "@/lib/server-actions/firmmates";
import {
  getFirmContextForContact,
  sendContactToTriage,
  setContactTriage,
  type FirmContext,
} from "@/lib/server-actions/triage";
import { FirmContextPanel } from "@/components/jasonos/runners/firm-context-panel";
import {
  generateDraftFromHistory,
  type DraftSource,
} from "@/lib/server-actions/draft-from-history";
import { INTENTS, INTENT_LABELS, type Intent } from "@/lib/triage/types";
import { extractFirstName, generateDraft } from "@/lib/triage/draft-templates";
import type { ReconnectContact, RecruiterStatus } from "@/lib/reconnect/types";
import type { FirstContactState } from "@/lib/first-contact/types";
import { RECRUITER_STATUS_LABELS } from "@/lib/reconnect/constants";
import { SCORE_MAX } from "@/lib/reconnect/score-constants";
import { TierBadge } from "@/components/jasonos/reconnect/tier-badge";
import { ScoreChip } from "@/components/jasonos/reconnect/score-chip";
import { FocusBadge } from "@/components/jasonos/reconnect/focus-badge";
import { NotesTimeline } from "@/components/jasonos/reconnect/notes-timeline";
import { FirstContactSequence } from "@/components/jasonos/reconnect/first-contact-sequence";

export interface RecruiterPipelineProps {
  contact: ReconnectContact;
  /** Other reconnect contacts in scope; used for "Other contacts at firm". */
  contacts: ReconnectContact[];
  onLocalStatus: (id: string, status: RecruiterStatus, note?: string) => void;
  onLocalNote: (id: string, body: string) => void;
  onLocalTriage: (
    id: string,
    intent: Intent | null,
    personalGoal: string | null
  ) => void;
  onLocalReconnectCardSent?: (id: string) => void;
  onLocalFirstContact?: (id: string, state: FirstContactState) => void;
}

// ---------------------------------------------------------------------------
// Header action cluster — rendered alongside the OutreachModal header's
// existing Classify button when a contact has a recruiter pipeline record.
// ---------------------------------------------------------------------------

export function RecruiterPipelineActions({
  contact,
  onLocalReconnectCardSent,
}: Pick<RecruiterPipelineProps, "contact" | "onLocalReconnectCardSent">) {
  const [isPending, startTransition] = useTransition();

  const sendToTriage = () => {
    startTransition(async () => {
      const result = await sendContactToTriage({ contactId: contact.id });
      if (!result.ok) {
        toast.error(result.error);
      } else if (result.alreadyExists) {
        toast.info("Already in your triage queue");
      } else {
        onLocalReconnectCardSent?.(contact.id);
        toast.success("Sent to Triage queue");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TierBadge tier={contact.tier} />
      <FocusBadge rank={contact.firm_focus_rank} />
      <ScoreChip score={contact.strategic_score} />
      <AskDispatchButton
        requestType="contact_strategy"
        sourcePage="/outreach/queue"
        context={{
          contact_id: contact.id,
          name: contact.name,
          company: contact.firm,
          relationship_tier: contact.tier,
          last_touch: contact.last_contact_date ?? null,
        }}
        label="Contact strategy"
      />
      <AskDispatchButton
        requestType="recruiter_strategy"
        sourcePage="/outreach/queue"
        context={{
          recruiter_id: contact.id,
          firm_name: contact.firm,
          practice_area: contact.specialty ?? contact.title ?? null,
          relationship_status: contact.state.status,
        }}
        label="Recruiter strategy"
      />
      {!contact.has_open_reconnect_card ? (
        <Button
          variant="outline"
          size="sm"
          onClick={sendToTriage}
          disabled={isPending}
        >
          <Inbox className="h-3.5 w-3.5" />
          Send to Triage
        </Button>
      ) : null}
      {contact.hubspot_url ? (
        <Button
          variant="outline"
          size="sm"
          render={<a href={contact.hubspot_url} target="_blank" />}
        >
          HubSpot <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body panel — rendered inside the OutreachModal scroll body.
// ---------------------------------------------------------------------------

export function RecruiterPipelinePanel({
  contact,
  contacts,
  onLocalStatus,
  onLocalNote,
  onLocalTriage,
  onLocalFirstContact,
}: Omit<RecruiterPipelineProps, "onLocalReconnectCardSent">) {
  const [note, setNote] = useState("");
  const [draftState, setDraftState] = useState({ key: "", text: "", base: "" });
  const [firmContext, setFirmContext] = useState<FirmContext | null>(null);
  const [firmmates, setFirmmates] = useState<Firmmate[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sourceState, setSourceState] = useState<{
    key: string;
    sources: DraftSource[];
    rationale: string;
  }>({ key: "", sources: [], rationale: "" });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!contact?.id) return;
    let active = true;
    getFirmContextForContact(contact.id)
      .then((data) => {
        if (active) setFirmContext(data ?? null);
      })
      .catch(() => {
        if (active) setFirmContext(null);
      });
    getFirmmates(contact.id)
      .then((data) => {
        if (active) setFirmmates(data);
      })
      .catch(() => {
        if (active) setFirmmates([]);
      });
    return () => {
      active = false;
    };
  }, [contact?.id]);

  const draftKey = contact.intent
    ? [
        contact.id,
        contact.intent,
        contact.personal_goal ?? "",
        contact.firm ?? "",
        contact.specialty ?? "",
      ].join("|")
    : "";
  const initialDraft = contact.intent
    ? generateDraft(contact.intent, {
        firstName: extractFirstName(contact.name),
        firm: contact.firm || undefined,
        specialty: contact.specialty || undefined,
        personalGoal: contact.personal_goal || undefined,
        channel: "linkedin",
      })
    : "";
  const draftText = draftState.key === draftKey ? draftState.text : initialDraft;
  const draftBase = draftState.key === draftKey ? draftState.base : initialDraft;
  const draftDirty = Boolean(draftKey && draftText !== draftBase);
  const sources = sourceState.key === draftKey ? sourceState.sources : [];
  const draftRationale = sourceState.key === draftKey ? sourceState.rationale : "";

  const firmMatches = contacts
    .filter((c) => c.id !== contact.id && firmKey(c) === firmKey(contact))
    .sort((a, b) => b.strategic_score - a.strategic_score);

  const updateStatus = (status: RecruiterStatus, prompt?: string) => {
    const context = prompt ? window.prompt(prompt) ?? undefined : undefined;
    onLocalStatus(contact.id, status, context);
    startTransition(async () => {
      const result = await setReconnectStatus(contact.id, status, context);
      toast[result.ok ? "success" : "error"](
        result.ok ? `${RECRUITER_STATUS_LABELS[status]} updated` : result.message
      );
    });
  };

  const updateTriage = (nextIntent: Intent | null) => {
    if (
      draftDirty &&
      nextIntent !== contact.intent &&
      !window.confirm(
        "Regenerate the outreach draft from the updated intent? Your edits will be replaced."
      )
    ) {
      return;
    }
    const goal =
      nextIntent === null
        ? null
        : window.prompt(
            "One-line goal for this contact",
            contact.personal_goal ?? ""
          ) ??
          contact.personal_goal ??
          null;

    onLocalTriage(contact.id, nextIntent, goal);
    startTransition(async () => {
      const result = await setContactTriage({
        contactId: contact.id,
        intent: nextIntent,
        personalGoal: goal,
      });
      toast[result.ok ? "success" : "error"](
        result.ok ? "Intent updated" : result.error
      );
    });
  };

  const submitNote = () => {
    if (!note.trim()) return;
    const body = note.trim();
    setNote("");
    onLocalNote(contact.id, body);
    startTransition(async () => {
      const result = await addReconnectNote(contact.id, body);
      toast[result.ok ? "success" : "error"](
        result.ok ? "Note added" : result.message
      );
    });
  };

  const setDraftText = (text: string) => {
    setDraftState({ key: draftKey, text, base: draftBase });
  };

  const regenerateDraft = () => {
    setDraftState({ key: draftKey, text: initialDraft, base: initialDraft });
    setSourceState({ key: "", sources: [], rationale: "" });
    toast.success("Draft regenerated");
  };

  const generateAiDraft = () => {
    if (!contact.intent) return;
    setIsGenerating(true);
    startTransition(async () => {
      const result = await generateDraftFromHistory({ contactId: contact.id });
      if (result.ok) {
        setDraftState({ key: draftKey, text: result.draft, base: result.draft });
        setSourceState({
          key: draftKey,
          sources: result.sources,
          rationale: result.rationale,
        });
        toast.success("Draft generated from history");
      } else {
        if (result.fallbackDraft) {
          setDraftState({
            key: draftKey,
            text: result.fallbackDraft,
            base: result.fallbackDraft,
          });
          setSourceState({
            key: draftKey,
            sources: [
              {
                source: "template_fallback",
                found: true,
                summary: result.error,
              },
            ],
            rationale: "AI draft failed, so the template fallback was used.",
          });
          toast.warning(`AI draft failed, using template: ${result.error}`);
        } else {
          toast.error(result.error);
        }
      }
      setIsGenerating(false);
    });
  };

  const copyDraftToClipboard = async () => {
    const body = draftText.trim();
    if (!body) return false;
    await navigator.clipboard.writeText(body);
    toast.success("Copied to clipboard");
    return true;
  };

  const markDraftAsSent = () => {
    const body = draftText.trim();
    if (!body) return;
    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(body);
        onLocalStatus(contact.id, "sent", body);
        const [statusResult, noteResult] = await Promise.all([
          setReconnectStatus(contact.id, "sent"),
          addReconnectNote(contact.id, body),
        ]);
        if (!statusResult.ok) {
          toast.error(statusResult.message);
        } else if (!noteResult.ok) {
          toast.error(noteResult.message);
        } else {
          toast.success("Copied and marked sent");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not copy draft");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Recruiter Pipeline
        <Badge variant="outline" className="ml-1 text-[9px]">
          intent: {contact.intent ? INTENT_LABELS[contact.intent] : "not set"}
        </Badge>
      </div>

      {contact.personal_goal ? (
        <blockquote className="border-l-2 border-foreground/40 pl-3 text-sm italic text-foreground/85">
          {contact.personal_goal}
        </blockquote>
      ) : null}

      <section className="rounded-xl border border-orange-400/20 bg-orange-400/5 p-4">
        <h3 className="text-sm font-semibold tracking-tight text-orange-200">
          Strategic Recommendation
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
          {contact.strategic_recommended_approach}
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold tracking-tight">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => updateStatus("sent")} disabled={isPending}>
            Mark Sent
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus("replied")}
            disabled={isPending}
          >
            Mark Replied
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus("snoozed")}
            disabled={isPending}
          >
            Snooze
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus("live_role", "One-line live role context")}
            disabled={isPending}
          >
            Mark Live Role
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => updateStatus("closed", "Outcome / close-out note")}
            disabled={isPending}
          >
            Close Out
          </Button>
        </div>
      </section>

      {firmContext ? (
        <section>
          <FirmContextPanel context={firmContext} />
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-semibold tracking-tight">Intent</h3>
        <div className="flex flex-wrap gap-2">
          {INTENTS.map((intent) => (
            <Button
              key={intent}
              size="sm"
              variant={contact.intent === intent ? "default" : "outline"}
              onClick={() => updateTriage(intent)}
              disabled={isPending}
            >
              {INTENT_LABELS[intent]}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => updateTriage(null)}
            disabled={isPending}
          >
            Clear
          </Button>
        </div>
      </section>

      {contact.first_contact ? (
        <FirstContactSequence
          contactId={contact.id}
          contactName={contact.name}
          state={contact.first_contact}
          onAdvance={(newState) => onLocalFirstContact?.(contact.id, newState)}
        />
      ) : null}

      {contact.intent && !contact.first_contact ? (
        <section className="rounded-xl border bg-background/30 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold tracking-tight">
              Recruiter draft outreach
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={generateAiDraft}
                disabled={isGenerating || !contact.intent}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                {isGenerating ? "Reading history..." : "Draft from history"}
              </Button>
              <Button size="sm" variant="ghost" onClick={regenerateDraft}>
                <RefreshCcw className="mr-1 h-3 w-3" />
                Template
              </Button>
            </div>
          </div>

          {sources.length ? (
            <DraftSourcesStrip sources={sources} rationale={draftRationale} />
          ) : null}

          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={9}
            className="font-mono text-sm"
          />

          <div className="mt-2 flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void copyDraftToClipboard()}
              disabled={!draftText.trim()}
            >
              <Copy className="mr-1 h-3 w-3" />
              Copy
            </Button>
            <Button
              size="sm"
              onClick={markDraftAsSent}
              disabled={!draftText.trim() || isPending}
            >
              Copy & mark sent
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Pick an intent above to generate a starter recruiter outreach draft.
          Your standard log-touch above stays available either way.
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold tracking-tight">Score Breakdown</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {(
            [
              ["Strategic", contact.strategic_score, SCORE_MAX.strategic],
              ["Firm Fit", contact.firm_fit_score, SCORE_MAX.firm_fit],
              ["Practice", contact.practice_match_score, SCORE_MAX.practice_match],
              ["Recency", contact.recency_score, SCORE_MAX.recency],
              ["Signal", contact.signal_score, SCORE_MAX.signal],
            ] as const
          ).map(([label, value, max]) => (
            <div key={label} className="rounded-lg border bg-background/40 p-3">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="num-mono mt-1 text-lg font-semibold">
                {value}
                <span className="text-sm font-normal text-muted-foreground">
                  /{max}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-orange-400"
                  style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Communication Context</h3>
        <ContextBlock label="Prior comms" body={contact.summary_of_prior_comms} />
        <ContextBlock label="Outlook history" body={contact.outlook_history} />
      </section>

      <Separator />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">Notes Timeline</h3>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitNote();
          }}
          placeholder="Add note... Cmd+Enter to save"
        />
        <Button size="sm" onClick={submitNote} disabled={isPending || !note.trim()}>
          Add note
        </Button>
        <NotesTimeline notes={contact.notes} touches={contact.touches} />
      </section>

      {firmmates.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold tracking-tight">
              Other contacts at {contact.firm}
            </h3>
            <span className="num-mono text-xs text-muted-foreground">
              {firmmates.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {firmmates.map((m) => {
              const benched = (m.firm_focus_rank ?? 0) > 3;
              return (
                <li
                  key={m.contact_id}
                  className={`flex items-center justify-between rounded-md border bg-background/40 px-2.5 py-2 text-sm ${benched ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FocusBadge rank={m.firm_focus_rank} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.name}</div>
                      {m.title ? (
                        <div className="text-xs text-muted-foreground truncate">
                          {m.title}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {m.strategic_score != null ? (
                    <span className="num-mono shrink-0 text-xs text-muted-foreground">
                      {m.strategic_score}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {firmmates.some((m) => (m.firm_focus_rank ?? 0) > 3) ? (
            <p className="text-xs text-amber-300/80">
              Don&rsquo;t reach the bench independently — search firms log all
              touches in shared CRMs (Invenias, Clockwork, Thrive). Let the
              anchor loop them in.
            </p>
          ) : null}
        </section>
      ) : firmMatches.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold tracking-tight">
              Who Else You Know At {contact.firm}
            </h3>
            <span className="num-mono text-xs text-muted-foreground">
              {firmMatches.length}
            </span>
          </div>
          <div className="space-y-2">
            {firmMatches.map((match) => (
              <div
                key={match.id}
                className="rounded-lg border bg-background/40 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{match.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {match.title || match.specialty || "No title captured"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <TierBadge tier={match.tier} />
                    <span className="num-mono text-xs text-muted-foreground">
                      {match.strategic_score}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : contact.other_contacts_at_firm ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold tracking-tight">
            Other contacts at {contact.firm}
          </h3>
          <div className="rounded-lg border p-3 text-xs text-muted-foreground">
            {contact.other_contacts_at_firm}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ContextBlock({ label, body }: { label: string; body?: string }) {
  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-foreground/85">
        {body || "No context captured yet."}
      </p>
    </div>
  );
}

function DraftSourcesStrip({
  sources,
  rationale,
}: {
  sources: DraftSource[];
  rationale?: string;
}) {
  const labels: Record<DraftSource["source"], string> = {
    hubspot: "HubSpot",
    gmail: "Gmail",
    granola: "Granola",
    fireflies: "Fireflies",
    rr_recruiter: "Recruiter notes",
    template_fallback: "Template",
  };

  return (
    <div className="mb-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span className="font-medium text-foreground/80">Sources used:</span>
        {sources.map((source) => (
          <span key={source.source} title={source.summary}>
            {source.found ? "✓" : "-"} {labels[source.source]}
          </span>
        ))}
      </div>
      {rationale ? <div className="mt-1 leading-relaxed">{rationale}</div> : null}
    </div>
  );
}

function firmKey(contact: ReconnectContact) {
  return (contact.firm_normalized || contact.firm).trim().toLowerCase();
}
