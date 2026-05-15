"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Loader2,
  Copy,
  Mail,
  Link2,
  RefreshCw,
  Star,
  Tag as TagIcon,
  CheckCircle2,
  History,
  ExternalLink,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassifyMenu } from "@/components/jasonos/outreach/classify-menu";
import { RelationshipBadge } from "@/components/jasonos/outreach/relationship-badge";
import {
  CADENCE_LABELS,
  CADENCE_STAGE_SHORT,
  TOUCH_OBJECTIVES,
  TOUCH_OBJECTIVE_HELPERS,
  TOUCH_OBJECTIVE_LABELS,
  type CadenceInterval,
  type CadenceStage,
  type RelationshipType,
  type TouchObjective,
} from "@/lib/outreach/types";
import {
  loadOutreachContext,
  generateOutreachDraft,
} from "@/lib/server-actions/outreach-draft";
import { logContactTouch } from "@/lib/server-actions/outreach";
import {
  LOG_TOUCH_CHANNELS,
  OUTREACH_DRAFT_MODES,
  OUTREACH_DRAFT_MODE_HELPERS,
  OUTREACH_DRAFT_MODE_LABELS,
  type LogTouchChannel,
  type OutreachDraftMode,
  type OutreachDraftResult,
  type RecentTouch,
} from "@/lib/outreach/draft-types";
import type { DraftSource } from "@/lib/server-actions/draft-from-history";

export interface ContactDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    name: string;
    title?: string | null;
    firm?: string | null;
    primary_email?: string | null;
    linkedin_url?: string | null;
    vip: boolean;
    relationship_type: RelationshipType | null;
    cadence_interval: CadenceInterval;
    cadence_stage?: CadenceStage | null;
    next_touch_date?: string | null;
    last_touch_date?: string | null;
  };
}

export function ContactDetailDrawer({
  open,
  onOpenChange,
  contact,
}: ContactDetailDrawerProps) {
  const router = useRouter();

  // -- Classify menu state
  const [classifyOpen, setClassifyOpen] = useState(false);

  // -- Context state
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [sources, setSources] = useState<DraftSource[] | null>(null);
  const [recentTouches, setRecentTouches] = useState<RecentTouch[]>([]);
  const [suggestedMode, setSuggestedMode] =
    useState<OutreachDraftMode>("cadence_touchpoint");

  // -- Draft state
  const [mode, setMode] = useState<OutreachDraftMode | "auto">("auto");
  const [draftBody, setDraftBody] = useState("");
  const [draftRationale, setDraftRationale] = useState("");
  const [draftMeta, setDraftMeta] =
    useState<Pick<OutreachDraftResult, "channel" | "mode"> | null>(null);
  const [generating, setGenerating] = useState(false);

  // -- Log-touch state
  const [logChannel, setLogChannel] = useState<LogTouchChannel>("email");
  const [logBrief, setLogBrief] = useState("");
  const [logObjective, setLogObjective] = useState<TouchObjective | null>(null);
  const [logOutcome, setLogOutcome] = useState("");
  const [logging, startLogTransition] = useTransition();

  // Pre-load context once when the drawer opens. Initial state already has
  // loadingCtx=true / sources=null so we don't reset synchronously here.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    loadOutreachContext({ contactId: contact.id })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          toast.error(result.error);
          setLoadingCtx(false);
          return;
        }
        setSources(result.sources);
        setRecentTouches(result.recentTouches);
        setSuggestedMode(result.suggestedMode);
        setLoadingCtx(false);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Failed to load context");
        setLoadingCtx(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, contact.id]);

  const effectiveMode: OutreachDraftMode = mode === "auto" ? suggestedMode : mode;

  const handleGenerate = () => {
    setGenerating(true);
    setDraftBody("");
    setDraftRationale("");
    setDraftMeta(null);
    generateOutreachDraft({
      contactId: contact.id,
      mode: mode === "auto" ? undefined : mode,
    })
      .then((result) => {
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setDraftBody(result.draft);
        setDraftRationale(result.rationale);
        setDraftMeta({ channel: result.channel, mode: result.mode });
        if (result.recentTouches.length) setRecentTouches(result.recentTouches);
        if (result.sources.length) setSources(result.sources);
        toast.success(
          `Drafted in ${OUTREACH_DRAFT_MODE_LABELS[result.mode]} mode`
        );
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Generation failed")
      )
      .finally(() => setGenerating(false));
  };

  const handleCopy = () => {
    if (!draftBody) return;
    navigator.clipboard.writeText(draftBody).then(
      () => toast.success("Draft copied to clipboard"),
      () => toast.error("Copy failed")
    );
  };

  const handleOpenInEmail = () => {
    if (!draftBody) return;
    const to = contact.primary_email ?? "";
    const subject =
      draftMeta?.channel === "email_reply" ? "Re: " : draftMeta?.channel === "linkedin"
        ? ""
        : `Quick note · ${contact.name}`;
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(draftBody)}`;
    window.open(url, "_blank");
  };

  const handleLog = () => {
    if (!logObjective) {
      toast.error("Pick an outcome — did this touch achieve its goal?");
      return;
    }
    startLogTransition(async () => {
      const result = await logContactTouch({
        contactId: contact.id,
        channel: logChannel,
        direction: "outbound",
        brief: logBrief.trim() || undefined,
        objectiveAchieved: logObjective,
        outcome: logOutcome.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const stageMsg =
        logObjective === "yes"
          ? "Cadence stage advanced."
          : "Cadence reset.";
      toast.success(
        `Logged ${logChannel} touch with ${contact.name}. ${stageMsg}`
      );
      setLogBrief("");
      setLogOutcome("");
      setLogObjective(null);
      router.refresh();
    });
  };

  const cadenceLabel =
    CADENCE_LABELS[contact.cadence_interval] || contact.cadence_interval;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full max-w-xl flex-col p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b px-5 py-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <SheetTitle className="flex items-center gap-2">
                  <span className="truncate">{contact.name}</span>
                  {contact.vip ? (
                    <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                  ) : null}
                  <RelationshipBadge type={contact.relationship_type} />
                </SheetTitle>
                <SheetDescription className="mt-0.5 truncate text-xs">
                  {[contact.title, contact.firm].filter(Boolean).join(" · ") ||
                    "No title or firm on file"}
                </SheetDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setClassifyOpen(true)}
              >
                <TagIcon className="h-3.5 w-3.5" />
                Classify
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3" />
                {cadenceLabel}
              </span>
              {contact.cadence_stage ? (
                <span
                  className="inline-flex items-center rounded-sm border border-foreground/20 bg-muted/60 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-foreground/80"
                  title={`Cadence arc: ${contact.cadence_stage}`}
                >
                  {CADENCE_STAGE_SHORT[contact.cadence_stage]}
                </span>
              ) : null}
              {contact.next_touch_date ? (
                <span>next: {fmtRelative(contact.next_touch_date)}</span>
              ) : null}
              {contact.last_touch_date ? (
                <span>last: {fmtRelative(contact.last_touch_date)}</span>
              ) : (
                <span className="italic">no touches yet</span>
              )}
              {contact.primary_email ? (
                <a
                  href={`mailto:${contact.primary_email}`}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Mail className="h-3 w-3" />
                  {contact.primary_email}
                </a>
              ) : null}
              {contact.linkedin_url ? (
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Link2 className="h-3 w-3" />
                  LinkedIn
                </a>
              ) : null}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <RecentContextSection
              loading={loadingCtx}
              sources={sources}
              recentTouches={recentTouches}
            />

            <DraftAssistSection
              loadingCtx={loadingCtx}
              suggestedMode={suggestedMode}
              mode={mode}
              setMode={setMode}
              effectiveMode={effectiveMode}
              draftBody={draftBody}
              setDraftBody={setDraftBody}
              draftRationale={draftRationale}
              draftMeta={draftMeta}
              generating={generating}
              onGenerate={handleGenerate}
              onCopy={handleCopy}
              onOpenInEmail={handleOpenInEmail}
              hasEmail={Boolean(contact.primary_email)}
            />

            <LogTouchSection
              channel={logChannel}
              setChannel={setLogChannel}
              brief={logBrief}
              setBrief={setLogBrief}
              outcome={logOutcome}
              setOutcome={setLogOutcome}
              objective={logObjective}
              setObjective={setLogObjective}
              onLog={handleLog}
              logging={logging}
              cadenceInterval={contact.cadence_interval}
            />
          </div>
        </SheetContent>
      </Sheet>

      {classifyOpen ? (
        <ClassifyMenu
          open={classifyOpen}
          onOpenChange={setClassifyOpen}
          contact={{
            id: contact.id,
            name: contact.name,
            relationship_type: contact.relationship_type,
            cadence_interval: contact.cadence_interval,
            vip: contact.vip,
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Recent Context section
// ---------------------------------------------------------------------------

function RecentContextSection({
  loading,
  sources,
  recentTouches,
}: {
  loading: boolean;
  sources: DraftSource[] | null;
  recentTouches: RecentTouch[];
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <History className="h-3 w-3" />
        Recent context
      </h3>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading Gmail / HubSpot / Granola / Fireflies…
        </div>
      ) : null}

      {!loading && sources ? (
        <div className="space-y-2">
          {recentTouches.length > 0 ? (
            <div className="rounded-md border bg-card/40 p-2.5">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent touches
              </div>
              <ul className="space-y-1">
                {recentTouches.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-2 text-[11px] text-muted-foreground"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-sm border px-1 py-0.5 text-[9px] uppercase",
                        t.direction === "outbound"
                          ? "border-emerald-500/40 text-emerald-300"
                          : "border-sky-500/40 text-sky-300"
                      )}
                    >
                      {t.channel}
                    </span>
                    <span className="shrink-0 font-mono text-[10px]">
                      {fmtShortDate(t.touched_at)}
                    </span>
                    <span className="truncate">{t.brief ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sources.map((s) => (
              <SourceCard key={s.source} source={s} />
            ))}
          </div>
        </div>
      ) : null}

      {!loading && sources && !sources.some((s) => s.found) && !recentTouches.length ? (
        <p className="text-xs text-muted-foreground">
          No prior history found across Gmail, HubSpot, Granola, Fireflies, or
          your prior notes. This will be drafted as a first reach.
        </p>
      ) : null}
    </section>
  );
}

function SourceCard({ source }: { source: DraftSource }) {
  return (
    <div
      className={cn(
        "rounded-md border p-2.5 text-[11px]",
        source.found ? "bg-card/40" : "border-dashed bg-transparent opacity-60"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
          {source.source.replace("_", " ")}
        </span>
        {source.found ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        ) : (
          <span className="text-[9px] uppercase text-muted-foreground/60">
            none
          </span>
        )}
      </div>
      {source.found && source.summary ? (
        <p className="mt-1 line-clamp-4 text-muted-foreground">
          {source.summary}
        </p>
      ) : null}
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Open
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft Assist section
// ---------------------------------------------------------------------------

function DraftAssistSection({
  loadingCtx,
  suggestedMode,
  mode,
  setMode,
  effectiveMode,
  draftBody,
  setDraftBody,
  draftRationale,
  draftMeta,
  generating,
  onGenerate,
  onCopy,
  onOpenInEmail,
  hasEmail,
}: {
  loadingCtx: boolean;
  suggestedMode: OutreachDraftMode;
  mode: OutreachDraftMode | "auto";
  setMode: (m: OutreachDraftMode | "auto") => void;
  effectiveMode: OutreachDraftMode;
  draftBody: string;
  setDraftBody: (s: string) => void;
  draftRationale: string;
  draftMeta: Pick<OutreachDraftResult, "channel" | "mode"> | null;
  generating: boolean;
  onGenerate: () => void;
  onCopy: () => void;
  onOpenInEmail: () => void;
  hasEmail: boolean;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Draft assist
      </h3>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode("auto")}
            className={modeChip(mode === "auto")}
          >
            Auto
            <span className="ml-1 text-[9px] font-normal text-muted-foreground">
              ({OUTREACH_DRAFT_MODE_LABELS[suggestedMode]})
            </span>
          </button>
          {OUTREACH_DRAFT_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={modeChip(mode === m)}
              title={OUTREACH_DRAFT_MODE_HELPERS[m]}
            >
              {OUTREACH_DRAFT_MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <Button
          onClick={onGenerate}
          disabled={generating || loadingCtx}
          className="w-full sm:w-auto"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {generating
            ? "Generating…"
            : draftBody
              ? `Regenerate (${OUTREACH_DRAFT_MODE_LABELS[effectiveMode]})`
              : `Generate (${OUTREACH_DRAFT_MODE_LABELS[effectiveMode]})`}
        </Button>

        {draftBody ? (
          <div className="space-y-2 pt-1">
            <Textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={Math.min(14, Math.max(6, draftBody.split("\n").length + 1))}
              className="font-sans text-sm"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <div className="space-x-2">
                {draftMeta ? (
                  <>
                    <span className="rounded border px-1.5 py-0.5">
                      {draftMeta.channel}
                    </span>
                    <span className="rounded border px-1.5 py-0.5">
                      {OUTREACH_DRAFT_MODE_LABELS[draftMeta.mode]}
                    </span>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={onCopy}>
                  <Copy className="h-3 w-3" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenInEmail}
                  disabled={!hasEmail}
                  title={
                    hasEmail
                      ? "Open in your default email client"
                      : "No email on file"
                  }
                >
                  <Send className="h-3 w-3" />
                  Email
                </Button>
              </div>
            </div>
            {draftRationale ? (
              <p className="text-[10px] italic text-muted-foreground/70">
                {draftRationale}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function modeChip(active: boolean) {
  return cn(
    "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border text-muted-foreground hover:text-foreground"
  );
}

// ---------------------------------------------------------------------------
// Log Touch section
// ---------------------------------------------------------------------------

function LogTouchSection({
  channel,
  setChannel,
  brief,
  setBrief,
  outcome,
  setOutcome,
  objective,
  setObjective,
  onLog,
  logging,
  cadenceInterval,
}: {
  channel: LogTouchChannel;
  setChannel: (c: LogTouchChannel) => void;
  brief: string;
  setBrief: (s: string) => void;
  outcome: string;
  setOutcome: (s: string) => void;
  objective: TouchObjective | null;
  setObjective: (v: TouchObjective | null) => void;
  onLog: () => void;
  logging: boolean;
  cadenceInterval: CadenceInterval;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <CheckCircle2 className="h-3 w-3" />
        Log a touch
      </h3>
      <div className="space-y-3 rounded-md border bg-card/40 p-3">
        {/* Channel */}
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            How
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LOG_TOUCH_CHANNELS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setChannel(c.value)}
                title={c.hint}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                  channel === c.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Objective tri-state */}
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Did this touch achieve its goal?{" "}
            <span className="font-normal text-muted-foreground/60">required</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {TOUCH_OBJECTIVES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setObjective(value)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors",
                  objective === value
                    ? value === "yes"
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                      : value === "no"
                      ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                      : "border-border bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="font-medium">{TOUCH_OBJECTIVE_LABELS[value]}</div>
                <div
                  className={cn(
                    "text-[10px] font-normal opacity-80",
                    objective === value ? "" : "text-muted-foreground/70"
                  )}
                >
                  {TOUCH_OBJECTIVE_HELPERS[value]}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <Input
          placeholder="One-line summary (optional)"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          className="h-8 text-xs"
        />

        {/* Outcome textarea */}
        <Textarea
          placeholder="Outcome / next step (optional)"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          rows={2}
          className="text-xs"
        />

        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground">
            {cadenceInterval === "none"
              ? "No cadence set — will only stamp last-touch."
              : objective === "yes"
              ? `Advances cadence stage and pushes next touch out by ${CADENCE_LABELS[cadenceInterval]?.toLowerCase()}.`
              : `Resets cadence clock by ${CADENCE_LABELS[cadenceInterval]?.toLowerCase()}.`}
          </p>
          <Button onClick={onLog} disabled={logging || !objective} size="sm">
            {logging ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Log touch
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtRelative(dateStr: string) {
  const target = new Date(
    dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0 && days <= 14) return `in ${days}d`;
  if (days < 0 && days >= -60) return `${Math.abs(days)}d ago`;
  return target.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fmtShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
