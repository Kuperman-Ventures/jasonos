"use client";

import { useEffect, useCallback, useTransition, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clock3,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Mail,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  addContactToNeedsSchedulingQueue,
  skipContactFromTriage,
  type FirmContext,
} from "@/lib/server-actions/triage";
import { type ReconnectCardBody } from "@/lib/triage/types";
import { FirmContextPanel } from "./firm-context-panel";
import { TierBadge } from "@/components/jasonos/reconnect/tier-badge";
import type { RecruiterTier } from "@/lib/reconnect/types";
import { Badge } from "@/components/ui/badge";

interface TriageRunnerProps {
  cardId: string;
  contactId: string;
  contactName: string;
  contactTitle: string | null;
  contactCompany: string | null;
  companyMissing: boolean;
  contactTags: string[];
  cardSubtitle: string | null;
  cardBody: ReconnectCardBody | null;
  daysSinceContact: number | null;
  remainingCount: number;
  firmContext: FirmContext | null;
  triagedThisSession: number;
  onTriaged: () => void;
  onAdvance: () => void;
}

export function TriageRunner(props: TriageRunnerProps) {
  const [pending, startTransition] = useTransition();
  const [lastAction, setLastAction] = useState<"queue" | "skip" | null>(null);

  const body = props.cardBody ?? {};
  const firm = getNonEmptyString(body.firm) ?? props.contactCompany;
  const firmSource = getNonEmptyString(body.firm) ? "source" : "tag";
  const specialty = getNonEmptyString(body.specialty);
  const priority = getNonEmptyString(body.strategic_priority);
  const strategicScore = getNumber(body.strategic_score);
  const firmFitScore = getNumber(body.firm_fit_score);
  const practiceScore = getNumber(body.practice_match_score);
  const recencyScore = getNumber(body.recency_score);
  const signalScore = getNumber(body.signal_score);
  const lastContact = getLastContactLabel(
    getNonEmptyString(body.last_contact_date),
    props.daysSinceContact,
    body.prior_communication
  );
  const scoreItems = [
    ["Strategic", strategicScore, 100],
    ["Firm Fit", firmFitScore, 40],
    ["Practice", practiceScore, 30],
    ["Recency", recencyScore, 15],
    ["Signal", signalScore, 15],
  ].filter((item): item is [string, number, number] => typeof item[1] === "number");

  const outlookHistory = getNonEmptyString(body.outlook_history);
  const aiSummary = getNonEmptyString(body.summary_of_prior_comms);
  const suggestedAngle = getNonEmptyString(body.strategic_recommended_approach);
  const showAiSummary =
    !outlookHistory && aiSummary && !isDuplicateSummary(aiSummary, suggestedAngle);
  const othersAtFirm = getNonEmptyString(body.other_contacts_at_firm);
  const linkedinUrl = getNonEmptyString(body.linkedin_url);
  const hasContext = Boolean(outlookHistory || showAiSummary || othersAtFirm || suggestedAngle);

  const handleAddToQueue = useCallback(() => {
    if (pending) return;
    setLastAction("queue");
    startTransition(async () => {
      const result = await addContactToNeedsSchedulingQueue({
        contactId: props.contactId,
        cardId: props.cardId,
      });
      if (result.ok) {
        toast.success(`${props.contactName} added to scheduling queue`);
        props.onTriaged();
        props.onAdvance();
      } else {
        toast.error(result.error);
      }
    });
  }, [pending, props]);

  const handleSkip = useCallback(() => {
    if (pending) return;
    setLastAction("skip");
    startTransition(async () => {
      const result = await skipContactFromTriage({
        contactId: props.contactId,
        cardId: props.cardId,
      });
      if (result.ok) {
        props.onAdvance();
      } else {
        toast.error(result.error);
      }
    });
  }, [pending, props]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (pending) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleAddToQueue();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pending, handleAddToQueue, handleSkip]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Triage · {props.triagedThisSession} done
        </div>
        <Badge variant="outline">{props.remainingCount} remaining</Badge>
      </div>

      {/* Who */}
      <section className="space-y-4 border-b px-5 py-5">
        <SectionKicker>Who</SectionKicker>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {props.contactName}
            </h2>
            {strategicScore ? <TierBadge tier={getTier(strategicScore)} /> : null}
            {priority ? (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                {priority} priority
              </Badge>
            ) : null}
          </div>

          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {props.contactTitle ?? "No title recorded"}
            </span>
            {firm ? (
              <>
                <span> · </span>
                <span className="font-medium text-foreground">{firm}</span>
              </>
            ) : null}
          </div>

          {specialty ? (
            <p className="text-sm text-muted-foreground">Specialty: {specialty}</p>
          ) : props.cardSubtitle ? (
            <p className="text-sm text-muted-foreground">{props.cardSubtitle}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {props.companyMissing && firm ? (
              <Badge variant="outline" className="h-5 rounded-full text-[10px]">
                Firm inferred from {firmSource}
              </Badge>
            ) : null}
            {props.companyMissing && !firm ? (
              <Badge variant="destructive" className="h-5 rounded-full text-[10px]">
                Missing company
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border bg-background/60 p-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-muted-foreground" />
            {lastContact ? (
              <span>Last contact: {lastContact}</span>
            ) : (
              <span className="text-muted-foreground">No prior contact recorded</span>
            )}
          </div>
          {scoreItems.length ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              {scoreItems.map(([label, score, max], index) => (
                <span key={label} className="text-muted-foreground">
                  {index > 0 ? "· " : null}
                  <span className="text-foreground">{label}</span> {score}/{max}
                </span>
              ))}
            </div>
          ) : null}
          {linkedinUrl ? (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
            >
              LinkedIn
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </section>

      {/* What We Know */}
      {hasContext ? (
        <section className="space-y-4 border-b px-5 py-5">
          <SectionKicker>What We Know</SectionKicker>
          <div className="space-y-3">
            {outlookHistory ? (
              <ContextBlock
                icon={<Mail className="h-4 w-4" />}
                title="Prior contact (from Outlook)"
                emphasis
              >
                {outlookHistory}
              </ContextBlock>
            ) : null}

            {showAiSummary ? (
              <ContextBlock
                icon={<Mail className="h-4 w-4" />}
                title={
                  <span className="inline-flex items-center gap-1">
                    Prior contact (AI-summarized)
                    <HelpCircle
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-label="Generated from import; may overlap with the suggested angle."
                    />
                  </span>
                }
                emphasis
              >
                {aiSummary}
              </ContextBlock>
            ) : null}

            {othersAtFirm ? (
              <ExpandableContextBlock
                icon={<Users className="h-4 w-4" />}
                title={`Others at ${firm ?? "this firm"} you know`}
                text={othersAtFirm}
              />
            ) : null}

            {suggestedAngle ? (
              <ContextBlock
                icon={<Lightbulb className="h-4 w-4 text-rung-ink" />}
                title="Suggested angle"
                accent
              >
                {suggestedAngle}
              </ContextBlock>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Firm context */}
      {props.firmContext ? (
        <section className="border-b px-5 py-5">
          <FirmContextPanel context={props.firmContext} />
        </section>
      ) : null}

      {/* Decision */}
      <div className="px-5 py-5 space-y-4">
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Add to "Needs to Be Scheduled" queue?
          </p>
          <p className="text-xs text-muted-foreground">
            Use arrow keys or click below
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* LEFT — Skip */}
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending}
            className={`group flex flex-col items-center gap-3 rounded-xl border px-4 py-5 transition-all disabled:opacity-50 ${
              lastAction === "skip" && pending
                ? "border-foreground/40 bg-muted/60"
                : "border-border/60 bg-background/40 hover:border-foreground/30 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                ←
              </kbd>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-foreground">No</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Don&rsquo;t schedule</div>
            </div>
          </button>

          {/* RIGHT — Add to Queue */}
          <button
            type="button"
            onClick={handleAddToQueue}
            disabled={pending}
            className={`group flex flex-col items-center gap-3 rounded-xl border px-4 py-5 transition-all disabled:opacity-50 ${
              lastAction === "queue" && pending
                ? "border-foreground bg-foreground/10"
                : "border-border bg-foreground/5 hover:border-foreground/60 hover:bg-foreground/10"
            }`}
          >
            <div className="flex items-center gap-2 text-foreground">
              <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                →
              </kbd>
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-foreground">
                {lastAction === "queue" && pending ? "Adding…" : "Yes"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Add to queue</div>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
          <span>{props.triagedThisSession} processed this session</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionKicker({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

function ContextBlock({
  icon,
  title,
  children,
  emphasis,
  muted,
  accent,
}: {
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
  emphasis?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        accent
          ? "border-[var(--jos-line)] bg-rung-2"
          : emphasis
            ? "bg-background"
            : muted
              ? "bg-muted/25 text-muted-foreground"
              : "bg-muted/30"
      }`}
    >
      <div
        className={`mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
          accent ? "text-rung-ink" : "text-muted-foreground"
        }`}
      >
        {icon}
        {title}
      </div>
      <p className={`leading-6 ${accent ? "font-medium text-foreground" : muted ? "text-sm" : ""}`}>
        {children}
      </p>
    </div>
  );
}

function ExpandableContextBlock({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = text.length > 200;
  const visibleText = shouldTruncate && !expanded ? `${text.slice(0, 200).trim()}...` : text;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <p className="leading-6">{visibleText}</p>
      {shouldTruncate ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs font-medium underline-offset-4 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTier(score: number): RecruiterTier {
  if (score >= 5) return "TIER 1";
  if (score >= 4) return "TIER 2";
  if (score >= 3) return "TIER 3";
  return "TIER 4";
}

function getLastContactLabel(
  value: string | null,
  daysSinceContact: number | null,
  priorCommunication: unknown
) {
  if (!value || priorCommunication === false) return null;
  try {
    const formatted = format(parseISO(value), "MMM d, yyyy");
    return daysSinceContact === null
      ? formatted
      : `${formatted} (${formatRelativeAge(daysSinceContact)})`;
  } catch {
    return null;
  }
}

function formatRelativeAge(days: number) {
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  if (days < 90) {
    const weeks = Math.max(1, Math.round(days / 7));
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  if (days <= 365) {
    const months = Math.max(1, Math.round(days / 30));
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

function isDuplicateSummary(summary: string, approach: string | null) {
  if (!approach) return false;
  const normalizedSummary = normalizeComparableText(summary);
  const normalizedApproach = normalizeComparableText(approach);
  if (normalizedSummary.length < 24 || normalizedApproach.length < 24) return false;
  return (
    normalizedSummary.includes(normalizedApproach) ||
    normalizedApproach.includes(normalizedSummary)
  );
}

function normalizeComparableText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
