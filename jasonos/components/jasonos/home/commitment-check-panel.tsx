"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, Handshake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DomainBand, StatusBand, StatusPill } from "@/components/jasonos/brand/status";
import { formatDue } from "@/lib/commitments/logic";
import {
  COMMITMENT_SECTIONS,
  SECTION_LABEL,
  type CommitmentCheckForHome,
  type CommitmentView,
} from "@/lib/commitments/types";
import {
  dismissCommitment,
  markCommitmentDone,
  snoozeCommitmentToTomorrow,
} from "@/lib/server-actions/commitments";

const STORAGE_KEY = "jasonos.commitment-check.collapsed";

const SOURCE_LABEL: Record<CommitmentView["source"], string> = {
  gmail: "Open in Gmail",
  granola: "Open in Granola",
  other: "Open source",
};

function checkedLabel(ymd: string): string {
  return formatDue(ymd);
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
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const items = (check?.items ?? []).filter((item) => !hidden.has(item.key));
  const overdue = items.filter((i) => i.section === "overdue").length;

  useEffect(() => {
    if (items.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(false);
      return;
    }
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // private mode / quota
    }
  }, [items.length]);

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
                    return (
                      <div key={section}>
                        <h3 className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {SECTION_LABEL[section]} · {rows.length}
                        </h3>
                        <ul className="divide-y divide-border">
                          {rows.map((item) => (
                            <li key={item.key} className="px-4 py-3">
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
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ok"
                                    disabled={busyKey === item.key}
                                    onClick={() => void run(item.key, () => markCommitmentDone(item.key), "Marked done")}
                                  >
                                    Done
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    disabled={busyKey === item.key}
                                    onClick={() =>
                                      void run(item.key, () => snoozeCommitmentToTomorrow(item.key), "Snoozed to tomorrow")
                                    }
                                  >
                                    Tomorrow
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    disabled={busyKey === item.key}
                                    onClick={() => void run(item.key, () => dismissCommitment(item.key), "Dismissed")}
                                  >
                                    Not a commitment
                                  </Button>
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
