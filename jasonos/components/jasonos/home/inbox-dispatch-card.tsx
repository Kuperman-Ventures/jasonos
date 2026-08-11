"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Inbox,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  Clock3,
  CircleDollarSign,
  PlugZap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  InboxDispatch,
  BoardingItem,
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

const STORAGE_KEY = "jasonos.inbox-dispatch.collapsed";

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

export function InboxDispatchCard() {
  const [data, setData] = useState<InboxDispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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

  // Initial fetch on mount. State is only set after the awaited fetch (never
  // synchronously in the effect body) and guarded so a fast unmount is a no-op.
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

  // Read collapsed preference after mount (matches Morning Brief).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // ignore private-mode / quota errors
    }
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

  const boardingCount = data?.boarding.length ?? 0;

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
                  ? summarize(data)
                  : "Connect Gmail to see who needs a reply"}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              collapsed && "-rotate-90"
            )}
          />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void load(true);
          }}
          disabled={refreshing || loading}
          className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          title="Re-run triage now"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {!collapsed ? (
        loading ? (
          <LoadingRows />
        ) : !data?.configured ? (
          <NotConnected />
        ) : (
          <div className="divide-y divide-border">
            {/* BOARDING */}
            {boardingCount === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Inbox clear — nobody is waiting on a reply. Rare and beautiful.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.boarding.map((item) => (
                  <BoardingRow key={item.threadId} item={item} />
                ))}
              </ul>
            )}

            {/* HOLDING */}
            {data.holding.length > 0 ? (
              <div className="px-4 py-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Waiting on them
                </p>
                <ul className="space-y-1">
                  {data.holding.map((h) => (
                    <li
                      key={h.threadId}
                      className="flex items-center gap-2 text-[12px]"
                    >
                      <span className="truncate text-foreground/80">
                        <span className="font-medium">{h.name}</span>
                        <span className="ml-1.5 text-muted-foreground">
                          {h.subject}
                        </span>
                      </span>
                      <a
                        href={h.gmailUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                        title="Open thread"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                        {h.ageDays}d
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* NOISE */}
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

function summarize(d: InboxDispatch): string {
  const parts: string[] = [];
  parts.push(`${d.boarding.length} need you`);
  if (d.holding.length) parts.push(`${d.holding.length} waiting`);
  if (d.noiseTotal) parts.push(`${d.noiseTotal} noise`);
  return parts.join(" · ");
}

function BoardingRow({ item }: { item: BoardingItem }) {
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-2.5 pl-5 text-left transition-colors hover:bg-muted/40"
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
          <p className="truncate text-[12px] text-muted-foreground">{item.subject}</p>
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

      {open ? (
        <div className="px-4 pb-3 pl-5">
          {item.draft ? (
            <pre className="whitespace-pre-wrap rounded-lg border bg-background/60 p-3 font-sans text-[13px] leading-relaxed text-foreground/90">
              {item.draft}
            </pre>
          ) : (
            <p className="rounded-lg border bg-background/60 p-3 text-[12px] italic text-muted-foreground">
              No draft generated — open the thread to reply.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copy}
              disabled={!item.draft}
              className="flex items-center gap-1.5 rounded-md bg-amber-500/90 px-2.5 py-1.5 text-[12px] font-medium text-amber-950 transition hover:bg-amber-400 disabled:opacity-40"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy draft"}
            </button>
            <a
              href={item.gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open thread
            </a>
          </div>
        </div>
      ) : null}
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
        waiting on you — each with a draft in your voice, ready to copy.
      </p>
    </div>
  );
}
