"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Inbox,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  Clock3,
  CircleDollarSign,
  PlugZap,
  Mail,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  InboxDispatch,
  BoardingItem,
  HoldingItem,
  Urgency,
} from "@/lib/integrations/inbox-triage";

const EMPTY_DISPATCH: InboxDispatch = {
  configured: false,
  generatedAt: "",
  boarding: [],
  holding: [],
  noise: [],
  noiseTotal: 0,
};

const COLLAPSE_KEY = "jasonos.inbox-dispatch.collapsed";
const DISMISS_KEY = "jasonos.inbox-dispatch.dismissed";

const URGENCY: Record<
  Urgency,
  { label: string; cls: string; icon?: React.ReactNode }
> = {
  now: {
    label: "Today",
    cls: "border-red-400/40 bg-red-500/15 text-red-200",
    icon: <Clock3 className="h-3 w-3" />,
  },
  paid: {
    label: "Paid call",
    cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
    icon: <CircleDollarSign className="h-3 w-3" />,
  },
  soon: {
    label: "Reply soon",
    cls: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  },
  normal: {
    label: "Reply",
    cls: "border-border bg-muted/40 text-muted-foreground",
  },
};

function shortWhen(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const days = Math.round((Date.now() - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function readDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore private-mode / quota errors
  }
}

/** Copy draft (if any), then open the real message in Apple Mail. */
async function openInAppleMail(opts: {
  appleMailUrl: string | null;
  draft?: string;
}): Promise<void> {
  if (!opts.appleMailUrl) {
    toast.error(
      "No Apple Mail link for this message. Is the account synced in Mail?"
    );
    return;
  }
  if (opts.draft?.trim()) {
    try {
      await navigator.clipboard.writeText(opts.draft);
      toast.success("Draft copied — open Mail, hit Reply, then paste.");
    } catch {
      toast.message("Opening Mail — copy the draft manually if needed.");
    }
  } else {
    toast.message("Opening in Apple Mail…");
  }
  // Navigate so Mail.app handles message:// (window.open is flaky for custom schemes).
  window.location.href = opts.appleMailUrl;
}

export function InboxDispatchCard() {
  const [data, setData] = useState<InboxDispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Manual refresh (Refresh button) — event handler, safe to setState.
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/inbox-dispatch${refresh ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as InboxDispatch;
      setData(json);
    } catch {
      setData((prev) => prev ?? EMPTY_DISPATCH);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/inbox-dispatch", { cache: "no-store" });
        const json = (await res.json()) as InboxDispatch;
        if (active) setData(json);
      } catch {
        if (active) setData((prev) => prev ?? EMPTY_DISPATCH);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Read collapsed + dismissed preferences after mount (avoid hydration mismatch).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
      setDismissed(readDismissed());
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const dismiss = (threadId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(threadId);
      writeDismissed(next);
      return next;
    });
  };

  const boarding = useMemo(
    () => (data?.boarding ?? []).filter((b) => !dismissed.has(b.threadId)),
    [data?.boarding, dismissed]
  );
  const holding = useMemo(
    () => (data?.holding ?? []).filter((h) => !dismissed.has(h.threadId)),
    [data?.holding, dismissed]
  );

  const boardingCount = boarding.length;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "Expand Inbox Dispatch" : "Collapse Inbox Dispatch"
          }
          className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:opacity-90"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
            <Inbox className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                Inbox Dispatch
              </h2>
              {!loading && data?.configured && boardingCount > 0 ? (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-amber-200">
                  {boardingCount}
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {loading
                ? "Scanning your inbox…"
                : data?.configured
                  ? summarize(boardingCount, holding.length, data.noiseTotal)
                  : "Connect Gmail to see who needs a reply"}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing || loading}
          className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          title="Re-run triage now"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          Refresh
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "Expand Inbox Dispatch" : "Collapse Inbox Dispatch"
          }
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "-rotate-90"
            )}
          />
        </button>
      </div>

      {!collapsed ? (
        loading ? (
          <LoadingRows />
        ) : !data?.configured ? (
          <NotConnected />
        ) : (
          <div className="divide-y divide-border">
            {boardingCount === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Inbox clear — nobody is waiting on a reply. Rare and beautiful.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {boarding.map((item) => (
                  <BoardingRow
                    key={item.threadId}
                    item={item}
                    onDismiss={() => dismiss(item.threadId)}
                  />
                ))}
              </ul>
            )}

            {holding.length > 0 ? (
              <div className="px-4 py-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Waiting on them
                </p>
                <ul className="space-y-1">
                  {holding.map((h) => (
                    <HoldingRow
                      key={h.threadId}
                      item={h}
                      onDismiss={() => dismiss(h.threadId)}
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            {data.noiseTotal > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/70">
                  {data.noiseTotal} cleared as noise
                </span>
                {data.noise.map((g) => (
                  <span key={g.label} className="tabular-nums">
                    {g.count}
                    {g.approx ? "+" : ""} {g.label.toLowerCase()}
                  </span>
                ))}
              </div>
            ) : null}

            {data.error ? (
              <p className="px-4 py-2 text-[11px] text-amber-300/80">
                Partial result: {data.error}
              </p>
            ) : null}
          </div>
        )
      ) : null}
    </section>
  );
}

function summarize(
  boardingCount: number,
  holdingCount: number,
  noiseTotal: number
): string {
  const parts: string[] = [];
  parts.push(`${boardingCount} need you`);
  if (holdingCount) parts.push(`${holdingCount} waiting`);
  if (noiseTotal) parts.push(`${noiseTotal} noise`);
  return parts.join(" · ");
}

function BoardingRow({
  item,
  onDismiss,
}: {
  item: BoardingItem;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const u = URGENCY[item.urgency];

  const copy = async () => {
    if (!item.draft) return;
    try {
      await navigator.clipboard.writeText(item.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          item.urgency === "now"
            ? "bg-red-400"
            : item.urgency === "paid"
              ? "bg-emerald-400"
              : "bg-amber-400/80"
        )}
      />
      <div className="flex items-start gap-1 pl-5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-start gap-3 px-4 py-2.5 pl-0 text-left transition-colors hover:bg-muted/40"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{item.name}</span>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  u.cls
                )}
              >
                {u.icon}
                {u.label}
              </span>
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {shortWhen(item.receivedAt)}
              </span>
            </div>
            <p className="truncate text-[12px] text-muted-foreground">
              {item.subject}
            </p>
            <p className="mt-1 border-l-2 border-amber-500/25 pl-2 text-[12.5px] leading-snug text-foreground/90">
              {item.elevator}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="mr-3 mt-2.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title="Dismiss"
          aria-label={`Dismiss ${item.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {open ? (
        <div className="px-4 pb-3 pl-5">
          {item.draft ? (
            <pre className="whitespace-pre-wrap rounded-lg border bg-background/60 p-3 font-sans text-[13px] leading-relaxed text-foreground/90">
              {item.draft}
            </pre>
          ) : (
            <p className="rounded-lg border bg-background/60 p-3 text-[12px] italic text-muted-foreground">
              No draft generated — open in Apple Mail to reply.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copy}
              disabled={!item.draft}
              className="flex items-center gap-1.5 rounded-md bg-amber-500/90 px-2.5 py-1.5 text-[12px] font-medium text-amber-950 transition hover:bg-amber-400 disabled:opacity-40"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy draft"}
            </button>
            <button
              type="button"
              onClick={() =>
                void openInAppleMail({
                  appleMailUrl: item.appleMailUrl,
                  draft: item.draft,
                })
              }
              disabled={!item.appleMailUrl}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              title={
                item.appleMailUrl
                  ? "Open this message in Apple Mail (draft copied)"
                  : "Message-ID unavailable for Apple Mail"
              }
            >
              <Mail className="h-3.5 w-3.5" />
              Open in Apple Mail
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function HoldingRow({
  item,
  onDismiss,
}: {
  item: HoldingItem;
  onDismiss: () => void;
}) {
  return (
    <li className="flex items-center gap-2 text-[12px]">
      <span className="min-w-0 flex-1 truncate text-foreground/80">
        <span className="font-medium">{item.name}</span>
        <span className="ml-1.5 text-muted-foreground">{item.subject}</span>
      </span>
      <button
        type="button"
        onClick={() =>
          void openInAppleMail({ appleMailUrl: item.appleMailUrl })
        }
        disabled={!item.appleMailUrl}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        title={
          item.appleMailUrl
            ? "Open in Apple Mail"
            : "Message-ID unavailable for Apple Mail"
        }
        aria-label={`Open ${item.name} in Apple Mail`}
      >
        <Mail className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        title="Dismiss"
        aria-label={`Dismiss ${item.name}`}
      >
        <X className="h-3 w-3" />
      </button>
      <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
        {item.ageDays}d
      </span>
    </li>
  );
}

function LoadingRows() {
  return (
    <div className="divide-y divide-border">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-8 flex-1 animate-pulse rounded bg-muted/40" />
        </div>
      ))}
    </div>
  );
}

function NotConnected() {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
      <PlugZap className="h-6 w-6 text-muted-foreground/50" />
      <p className="text-xs font-medium">Gmail not connected</p>
      <p className="max-w-xs text-[11px] text-muted-foreground">
        Connect Google in Settings and this fills with the threads actually
        waiting on you — each with a draft in your voice, ready for Apple Mail.
      </p>
    </div>
  );
}
