"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ExternalLink, Handshake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DomainBand, StatusBand, StatusPill } from "@/components/jasonos/brand/status";
import { CommitmentScheduleDialog } from "@/components/jasonos/home/commitment-schedule-dialog";
import { formatDue } from "@/lib/commitments/logic";
import {
  COMMITMENT_SECTIONS,
  SECTION_LABEL,
  type CommitmentCheckForHome,
  type CommitmentSection,
  type CommitmentView,
} from "@/lib/commitments/types";
import {
  dismissCommitment,
  markCommitmentDone,
  snoozeCommitmentToTomorrow,
} from "@/lib/server-actions/commitments";

const STORAGE_KEY = "jasonos.commitment-check.collapsed";
const SECTION_STORAGE_KEY = "jasonos.commitment-check.section-collapsed";

/** Sections start expanded; Scheduled defaults collapsed once you have a calendar block. */
const DEFAULT_SECTION_COLLAPSED: Record<CommitmentSection, boolean> = {
  overdue: false,
  due_today: false,
  coming_up: false,
  no_date: false,
  scheduled: true,
};

const SOURCE_LABEL: Record<CommitmentView["source"], string> = {
  gmail: "Open in Gmail",
  granola: "Open in Granola",
  other: "Open source",
};

function checkedLabel(ymd: string): string {
  return formatDue(ymd);
}

function readSectionCollapsed(): Record<CommitmentSection, boolean> {
  const next = { ...DEFAULT_SECTION_COLLAPSED };
  try {
    const raw = window.localStorage.getItem(SECTION_STORAGE_KEY);
    if (!raw) return next;
    const parsed = JSON.parse(raw) as Partial<Record<CommitmentSection, boolean>>;
    for (const section of COMMITMENT_SECTIONS) {
      if (typeof parsed[section] === "boolean") next[section] = parsed[section];
    }
  } catch {
    // private mode / bad JSON
  }
  return next;
}

/**
 * Home panel for the weekday Commitment Check: promises Jason made with a time
 * attached that are not yet delivered. Published by the Claude scheduled task
 * through the JasonOS MCP tool publish_commitment_check.
 */
export function CommitmentCheckPanel({
  check,
  error,
}: {
  check: CommitmentCheckForHome | null;
  error: string | null;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);
  const [sectionCollapsed, setSectionCollapsed] = useState(DEFAULT_SECTION_COLLAPSED);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [scheduleItem, setScheduleItem] = useState<CommitmentView | null>(null);

  const items = (check?.items ?? []).filter((item) => !hidden.has(item.key));
  const overdue = items.filter((i) => i.section === "overdue").length;

  useEffect(() => {
    try {
      // Default collapsed; only expand if Jason previously chose open.
      if (window.localStorage.getItem(STORAGE_KEY) === "0") setCollapsed(false);
    } catch {
      // private mode / quota
    }
    setSectionCollapsed(readSectionCollapsed());
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleSection = (section: CommitmentSection) => {
    setSectionCollapsed((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      try {
        window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const run = async (
    key: string,
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string
  ) => {
    setBusyKey(key);
    setHidden((prev) => new Set(prev).add(key));
    const result = await action();
    setBusyKey(null);
    if (!result.ok) {
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast.error(result.error);
      return;
    }
    toast.success(success);
    router.refresh();
  };

  const unavailable = check?.sources
    ? (["gmail", "granola"] as const).filter((s) => check.sources?.[s] === "unavailable")
    : [];

  return (
    <section className="overflow-hidden">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand Commitments" : "Collapse Commitments"}
        className="w-full text-left"
      >
        {overdue > 0 ? (
          <StatusBand rung={1}>
            <Handshake className="h-5 w-5" />
            <h2 className="text-[17px] font-bold tracking-tight">Commitments</h2>
            <StatusPill rung={4}>{overdue} overdue</StatusPill>
            <StatusPill rung={4} className="ml-auto">
              {items.length}
            </StatusPill>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
          </StatusBand>
        ) : (
          <DomainBand domain="todo">
            <Handshake className="h-5 w-5" />
            <h2 className="text-[17px] font-bold tracking-tight">Commitments</h2>
            <StatusPill rung={4} className="ml-auto">
              {items.length}
            </StatusPill>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
          </DomainBand>
        )}
      </button>

      {!collapsed ? (
        <div>
          {error ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Commitments could not be loaded: {error}
            </p>
          ) : !check?.check_date ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No commitment check has been published yet. It appears here after the weekday check runs.
            </p>
          ) : (
            <>
              <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
                {check.is_stale ? `From the ${checkedLabel(check.check_date)} check. ` : "Checked today. "}
                Sections are recalculated for today. {check.delivered_count} delivered in the last 14 days.
                {check.hidden_count > 0 ? ` ${check.hidden_count} marked done, dismissed or snoozed.` : ""}
                {unavailable.length
                  ? ` ${unavailable.map((s) => (s === "gmail" ? "Gmail" : "Granola")).join(" and ")} could not be read on that run.`
                  : ""}
              </p>
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Nothing open. Every promise in the latest check is delivered or marked.
                </p>
              ) : (
                <div className="max-h-[calc(10*6rem)] overflow-y-auto overscroll-contain">
                  {COMMITMENT_SECTIONS.map((section) => {
                    const rows = items.filter((i) => i.section === section);
                    if (!rows.length) return null;
                    const sectionClosed = sectionCollapsed[section];
                    return (
                      <div key={section}>
                        <button
                          type="button"
                          onClick={() => toggleSection(section)}
                          aria-expanded={!sectionClosed}
                          aria-label={
                            sectionClosed
                              ? `Expand ${SECTION_LABEL[section]}`
                              : `Collapse ${SECTION_LABEL[section]}`
                          }
                          className="flex w-full items-center gap-2 bg-muted/40 px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                        >
                          <span>
                            {SECTION_LABEL[section]} · {rows.length}
                          </span>
                          <ChevronDown
                            className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${
                              sectionClosed ? "-rotate-90" : ""
                            }`}
                          />
                        </button>
                        {!sectionClosed ? (
                          <ul className="divide-y divide-border">
                            {rows.map((item) => (
                              <CommitmentRow
                                key={item.key}
                                item={item}
                                busy={busyKey === item.key}
                                onSchedule={() => setScheduleItem(item)}
                                onDone={() =>
                                  void run(item.key, () => markCommitmentDone(item.key), "Marked done")
                                }
                                onTomorrow={() =>
                                  void run(
                                    item.key,
                                    () => snoozeCommitmentToTomorrow(item.key),
                                    "Snoozed to tomorrow"
                                  )
                                }
                                onDismiss={() =>
                                  void run(item.key, () => dismissCommitment(item.key), "Dismissed")
                                }
                              />
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      <CommitmentScheduleDialog
        item={scheduleItem}
        open={Boolean(scheduleItem)}
        onOpenChange={(next) => {
          if (!next) setScheduleItem(null);
        }}
        onScheduled={() => {
          setScheduleItem(null);
          router.refresh();
        }}
      />
    </section>
  );
}

function CommitmentRow({
  item,
  busy,
  onSchedule,
  onDone,
  onTomorrow,
  onDismiss,
}: {
  item: CommitmentView;
  busy: boolean;
  onSchedule: () => void;
  onDone: () => void;
  onTomorrow: () => void;
  onDismiss: () => void;
}) {
  return (
    <li className="px-4 py-3">
      <p className="text-sm font-medium">&ldquo;{item.promise}&rdquo;</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        To {item.to} · {item.due_date ? `Due ${formatDue(item.due_date)}` : "No date set"}
        {item.context ? ` · ${item.context}` : ""}
      </p>
      {item.delivery === "possibly_delivered" ? (
        <p className="mt-1 flex items-start gap-2 text-xs">
          <StatusPill rung={2}>Possibly delivered</StatusPill>
          {item.evidence ? <span className="text-muted-foreground">{item.evidence}</span> : null}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {item.source_url ? (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--jos-action)] underline underline-offset-2"
          >
            {SOURCE_LABEL[item.source]} <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
        <span className="ml-auto flex flex-wrap gap-1.5">
          <Button type="button" size="xs" variant="outline" disabled={busy} onClick={onSchedule}>
            <CalendarDays className="h-3 w-3" />
            Calendar
          </Button>
          <Button type="button" size="xs" variant="ok" disabled={busy} onClick={onDone}>
            Done
          </Button>
          <Button type="button" size="xs" variant="outline" disabled={busy} onClick={onTomorrow}>
            Tomorrow
          </Button>
          <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={onDismiss}>
            Not a commitment
          </Button>
        </span>
      </div>
    </li>
  );
}
