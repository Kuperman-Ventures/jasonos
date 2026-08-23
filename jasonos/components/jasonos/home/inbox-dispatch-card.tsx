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
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getInboxDispatchPrefs,
  setInboxDispatchPrefs,
  type SavedEntry,
} from "@/lib/server-actions/inbox-dispatch-prefs";
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
const SAVE_KEY = "jasonos.inbox-dispatch.saved";

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

function isBoardingItem(v: unknown): v is BoardingItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.threadId === "string" &&
    typeof o.name === "string" &&
    typeof o.subject === "string"
  );
}

function isHoldingItem(v: unknown): v is HoldingItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.threadId === "string" &&
    typeof o.name === "string" &&
    typeof o.subject === "string" &&
    (typeof o.ageDays === "number" || o.ageDays === undefined)
  );
}

function readSaved(): SavedEntry[] {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: SavedEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const savedAt =
        typeof r.savedAt === "string" ? r.savedAt : new Date().toISOString();
      if (r.kind === "boarding" && isBoardingItem(r.item)) {
        out.push({ kind: "boarding", savedAt, item: r.item });
      } else if (r.kind === "holding" && isHoldingItem(r.item)) {
        out.push({ kind: "holding", savedAt, item: r.item });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function writeSaved(entries: SavedEntry[]) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

async function persistPrefs(saved: SavedEntry[], dismissed: Set<string>) {
  writeSaved(saved);
  writeDismissed(dismissed);
  const res = await setInboxDispatchPrefs(saved, [...dismissed]);
  if (!res.ok) {
    console.warn("[inbox-dispatch] prefs save failed:", res.error);
    toast.error(`Could not save Inbox Dispatch prefs: ${res.error}`);
  }
  return res;
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
  window.location.href = opts.appleMailUrl;
}

/**
 * When today's triage still includes a saved thread, refresh the snapshot
 * (newer draft / urgency) but keep savedAt.
 */
function mergeSavedWithLive(
  saved: SavedEntry[],
  data: InboxDispatch | null
): SavedEntry[] {
  if (!data) return saved;
  const boardingById = new Map(data.boarding.map((b) => [b.threadId, b]));
  const holdingById = new Map(data.holding.map((h) => [h.threadId, h]));
  let changed = false;
  const next = saved.map((entry) => {
    if (entry.kind === "boarding") {
      const live = boardingById.get(entry.item.threadId);
      if (!live) return entry;
      changed = true;
      return { ...entry, item: live };
    }
    const live = holdingById.get(entry.item.threadId);
    if (!live) return entry;
    changed = true;
    return { ...entry, item: live };
  });
  return changed ? next : saved;
}

function SavedList({
  entries,
  onDismiss,
  onUnsave,
}: {
  entries: SavedEntry[];
  onDismiss: (threadId: string) => void;
  onUnsave: (threadId: string) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) =>
        entry.kind === "boarding" ? (
          <BoardingRow
            key={`saved-${entry.item.threadId}`}
            item={entry.item}
            saved
            onDismiss={() => onDismiss(entry.item.threadId)}
            onSave={() => onUnsave(entry.item.threadId)}
          />
        ) : (
          <li key={`saved-h-${entry.item.threadId}`} className="px-4 py-2">
            <HoldingRow
              item={entry.item}
              saved
              onDismiss={() => onDismiss(entry.item.threadId)}
              onSave={() => onUnsave(entry.item.threadId)}
            />
          </li>
        )
      )}
    </ul>
  );
}

function SavedSection({
  count,
  entries,
  onDismiss,
  onUnsave,
}: {
  count: number;
  entries: SavedEntry[];
  onDismiss: (threadId: string) => void;
  onUnsave: (threadId: string) => void;
}) {
  return (
    <div className="border-b border-border">
      <p className="flex items-center gap-1.5 px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <BookmarkCheck className="h-3 w-3 text-sky-300" />
        Saved for later ({count})
      </p>
      {entries.length > 0 ? (
        <SavedList entries={entries} onDismiss={onDismiss} onUnsave={onUnsave} />
      ) : (
        <p className="px-4 pb-3 text-[11px] leading-relaxed text-muted-foreground">
          Bookmark a thread from today&apos;s list to park it here. Saved emails
          stay until you dismiss them — they sync across sessions.
        </p>
      )}
    </div>
  );
}

export function InboxDispatchCard() {
  const [data, setData] = useState<InboxDispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<SavedEntry[]>([]);
  const [prefsReady, setPrefsReady] = useState(false);

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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
      } catch {
        // ignore
      }

      const localSaved = readSaved();
      const localDismissed = readDismissed();
      let serverSaved: SavedEntry[] = [];
      let serverDismissed: string[] = [];

      try {
        const prefs = await getInboxDispatchPrefs();
        serverSaved = prefs.saved;
        serverDismissed = prefs.dismissed;
      } catch {
        // fall back to local only
      }

      if (!active) return;

      let nextSaved = serverSaved;
      let nextDismissed = new Set(serverDismissed);

      // Upload browser saves when the server copy is still empty (retry after failed saves).
      if (serverSaved.length === 0 && localSaved.length > 0) {
        nextSaved = localSaved;
        if (localDismissed.size > 0) nextDismissed = localDismissed;
        const res = await persistPrefs(nextSaved, nextDismissed);
        if (res.ok) {
          toast.success(
            `Restored ${nextSaved.length} saved email${nextSaved.length === 1 ? "" : "s"} from this browser.`
          );
        }
      } else if (serverSaved.length > 0) {
        writeSaved(serverSaved);
        writeDismissed(nextDismissed);
      }

      setSaved(nextSaved);
      setDismissed(nextDismissed);
      setPrefsReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Refresh saved snapshots when live triage still has those threads.
  useEffect(() => {
    if (!data || !prefsReady) return;
    setSaved((prev) => {
      const merged = mergeSavedWithLive(prev, data);
      if (merged !== prev) {
        writeSaved(merged);
        setDismissed((d) => {
          void persistPrefs(merged, d);
          return d;
        });
      }
      return merged;
    });
  }, [data, prefsReady]);

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

  const savedIds = useMemo(
    () => new Set(saved.map((e) => e.item.threadId)),
    [saved]
  );

  const dismiss = (threadId: string) => {
    setSaved((prevSaved) => {
      const nextSaved = prevSaved.filter((e) => e.item.threadId !== threadId);
      setDismissed((prevD) => {
        const nextD = new Set(prevD);
        nextD.add(threadId);
        writeDismissed(nextD);
        writeSaved(nextSaved);
        void persistPrefs(nextSaved, nextD);
        return nextD;
      });
      return nextSaved;
    });
  };

  const saveBoarding = (item: BoardingItem) => {
    setSaved((prev) => {
      if (prev.some((e) => e.item.threadId === item.threadId)) return prev;
      const next: SavedEntry[] = [
        { kind: "boarding", savedAt: new Date().toISOString(), item },
        ...prev,
      ];
      writeSaved(next);
      setDismissed((d) => {
        const revived = new Set(d);
        revived.delete(item.threadId);
        writeDismissed(revived);
        void persistPrefs(next, revived);
        return revived;
      });
      return next;
    });
    toast.success("Saved — it’ll stay in Dispatch until you dismiss it.");
  };

  const saveHolding = (item: HoldingItem) => {
    setSaved((prev) => {
      if (prev.some((e) => e.item.threadId === item.threadId)) return prev;
      const next: SavedEntry[] = [
        { kind: "holding", savedAt: new Date().toISOString(), item },
        ...prev,
      ];
      writeSaved(next);
      setDismissed((d) => {
        const revived = new Set(d);
        revived.delete(item.threadId);
        writeDismissed(revived);
        void persistPrefs(next, revived);
        return revived;
      });
      return next;
    });
    toast.success("Saved — it’ll stay in Dispatch until you dismiss it.");
  };

  const unsave = (threadId: string) => {
    setSaved((prev) => {
      const next = prev.filter((e) => e.item.threadId !== threadId);
      writeSaved(next);
      setDismissed((d) => {
        void persistPrefs(next, d);
        return d;
      });
      return next;
    });
    toast.message("Removed from Saved.");
  };

  // Today's lists: hide dismissed + anything already parked in Saved (no dupes).
  const boarding = useMemo(
    () =>
      (data?.boarding ?? []).filter(
        (b) => !dismissed.has(b.threadId) && !savedIds.has(b.threadId)
      ),
    [data?.boarding, dismissed, savedIds]
  );
  const holding = useMemo(
    () =>
      (data?.holding ?? []).filter(
        (h) => !dismissed.has(h.threadId) && !savedIds.has(h.threadId)
      ),
    [data?.holding, dismissed, savedIds]
  );

  const visibleSaved = useMemo(
    () => saved.filter((e) => !dismissed.has(e.item.threadId)),
    [saved, dismissed]
  );

  const boardingCount = boarding.length;
  const headerCount = boardingCount + visibleSaved.length;

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
              {!loading && data?.configured && headerCount > 0 ? (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-amber-200">
                  {headerCount}
                </span>
              ) : null}
              {!loading && visibleSaved.length > 0 ? (
                <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-sky-200">
                  {visibleSaved.length} saved
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {loading
                ? "Scanning your inbox…"
                : data?.configured
                  ? summarize(
                      boardingCount,
                      holding.length,
                      data.noiseTotal,
                      visibleSaved.length
                    )
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
            <SavedSection
              count={visibleSaved.length}
              entries={visibleSaved}
              onDismiss={dismiss}
              onUnsave={unsave}
            />

            {boardingCount === 0 && visibleSaved.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Inbox clear — nobody is waiting on a reply. Rare and beautiful.
              </p>
            ) : boardingCount === 0 ? (
              <p className="px-4 py-3 text-center text-[11px] text-muted-foreground">
                Nothing new today — your saved items are above.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {boarding.map((item) => (
                  <BoardingRow
                    key={item.threadId}
                    item={item}
                    onDismiss={() => dismiss(item.threadId)}
                    onSave={() => saveBoarding(item)}
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
                      onSave={() => saveHolding(h)}
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
  noiseTotal: number,
  savedCount: number
): string {
  const parts: string[] = [];
  parts.push(`${boardingCount} need you`);
  if (savedCount) parts.push(`${savedCount} saved`);
  if (holdingCount) parts.push(`${holdingCount} waiting`);
  if (noiseTotal) parts.push(`${noiseTotal} noise`);
  return parts.join(" · ");
}

function BoardingRow({
  item,
  onDismiss,
  onSave,
  saved = false,
}: {
  item: BoardingItem;
  onDismiss: () => void;
  onSave: () => void;
  saved?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const u = URGENCY[item.urgency] ?? URGENCY.normal;

  const copy = async () => {
    if (!item.draft) return;
    try {
      await navigator.clipboard.writeText(item.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          saved
            ? "bg-sky-400/80"
            : item.urgency === "now"
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
              {saved ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-200">
                  <BookmarkCheck className="h-3 w-3" />
                  Saved
                </span>
              ) : (
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    u.cls
                  )}
                >
                  {u.icon}
                  {u.label}
                </span>
              )}
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
          onClick={onSave}
          className="mt-2.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title={saved ? "Remove from Saved" : "Save for later"}
          aria-label={
            saved ? `Unsave ${item.name}` : `Save ${item.name} for later`
          }
        >
          {saved ? (
            <BookmarkCheck className="h-3.5 w-3.5 text-sky-300" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" />
          )}
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
              onClick={onSave}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {saved ? (
                <BookmarkCheck className="h-3.5 w-3.5" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
              {saved ? "Unsave" : "Save"}
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
  onSave,
  saved = false,
}: {
  item: HoldingItem;
  onDismiss: () => void;
  onSave: () => void;
  saved?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-[12px]">
      <span className="min-w-0 flex-1 truncate text-foreground/80">
        <span className="font-medium">{item.name}</span>
        <span className="ml-1.5 text-muted-foreground">{item.subject}</span>
        {saved ? (
          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-sky-300">
            saved
          </span>
        ) : null}
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
        onClick={onSave}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        title={saved ? "Remove from Saved" : "Save for later"}
        aria-label={
          saved ? `Unsave ${item.name}` : `Save ${item.name} for later`
        }
      >
        {saved ? (
          <BookmarkCheck className="h-3 w-3 text-sky-300" />
        ) : (
          <Bookmark className="h-3 w-3" />
        )}
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
