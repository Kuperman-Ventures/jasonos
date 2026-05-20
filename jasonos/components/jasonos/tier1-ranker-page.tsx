"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Search,
  ArrowDownUp,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Inbox,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { ActionCard } from "@/lib/types";
import {
  ALL_CLUSTERS,
  CLUSTER_LABEL,
  STRATEGY_INFO,
  autoRank,
  clusterOf,
  daysAgoLabel,
  lastTouchTier,
  score,
  scoreBreakdown,
  type AlumniCluster,
  type RankStrategy,
  type RankerWeights,
} from "@/lib/ranker/score";
import {
  finishTier1,
  saveRunnerState,
  upsertContactScore,
} from "@/lib/actions/contacts";
import { sendContactToTriage } from "@/lib/server-actions/triage";
import {
  RUNNER_ID,
  TASK_ID,
  type RankableContact,
  type RunnerStateShape,
} from "@/lib/contacts/runner";
import { CandidateImport } from "@/components/jasonos/candidate-import";
import { ContactCreateModal } from "@/components/jasonos/outreach/contact-create-modal";

// ---- Cluster chip palette (Tailwind utility classes) ---------------------

const CLUSTER_CHIP: Record<AlumniCluster | "all", string> = {
  all: "bg-muted text-foreground",
  tbwa: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  agency: "bg-pink-500/15 text-pink-300 border border-pink-500/30",
  omnicom: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  videri: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
  outfront: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  industry: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  other: "bg-muted text-muted-foreground border",
};

const TIER_BG = "bg-sky-400/[0.06] border-l-[3px] border-l-sky-400";

const RECENCY_TIER_DOT: Record<string, string> = {
  fresh: "bg-emerald-400",
  ok: "bg-muted-foreground",
  stale: "bg-amber-400",
  cold: "bg-red-400",
};

const TARGET_SIZE = 30;

// --------------------------------------------------------------------------

type ViewMode = "all" | "tier1" | "untagged";

interface Props {
  contacts: RankableContact[];
  initialState: RunnerStateShape;
  existingPicks: ActionCard[];
  configured: boolean;
}

interface PendingScore {
  recency: number;
  seniority: number;
  fit: number;
}

export function Tier1RankerPage({
  contacts,
  initialState,
  existingPicks,
  configured,
}: Props) {
  const [weights, setWeights] = useState<RankerWeights>(initialState.weights);
  const [strategy, setStrategy] = useState<RankStrategy>(initialState.strategy);
  const [search, setSearch] = useState("");
  const [activeCluster, setActiveCluster] = useState<AlumniCluster | "all">(
    "all"
  );
  const [view, setView] = useState<ViewMode>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [recruitersOpen, setRecruitersOpen] = useState(true);
  const [contactsOpen, setContactsOpen] = useState(true);

  // Optimistic, in-memory score overrides — server eventually catches up via
  // revalidatePath. Lets the score column update instantly when a pip is clicked.
  const [pendingScores, setPendingScores] = useState<Record<string, PendingScore>>(
    {}
  );

  // Selected contact ids (Tier-1 picks). Pre-seeded with whatever's currently
  // in jasonos.cards as open tier-1 reconnects.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const card of existingPicks) {
      const cid = card.linked_object_ids?.contact_id;
      if (cid) s.add(cid);
    }
    return s;
  });

  // Last-applied auto-rank ordering (so "Finish" knows the rank for each pick).
  const [autoOrder, setAutoOrder] = useState<string[] | null>(null);

  // After auto-rank runs, the table re-sorts by computed score desc (with
  // unscored rows tied at the bottom, name-asc tiebreak) so the user can see
  // what the strategy chose. Reset to "default" if the user re-imports etc.
  const [sortMode, setSortMode] = useState<"default" | "byScore">("default");

  const [isFinishing, startFinish] = useTransition();
  const [finishStatus, setFinishStatus] = useState<string | null>(null);

  // Debounced runner_state save when weights/strategy change.
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!configured) return;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      void saveRunnerState(RUNNER_ID, TASK_ID, { weights, strategy });
    }, 500);
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, [weights, strategy, configured]);

  // ---- Derived data -------------------------------------------------------

  const effectiveScores = useMemo(() => {
    return contacts.map((rc) => {
      const pending = pendingScores[rc.contact.id];
      if (pending) {
        return {
          ...rc,
          score: {
            id: rc.score?.id ?? `pending-${rc.contact.id}`,
            contact_id: rc.contact.id,
            recency: pending.recency,
            seniority: pending.seniority,
            fit: pending.fit,
            scored_by: "user" as const,
            notes: rc.score?.notes,
            created_at: rc.score?.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };
      }
      return rc;
    });
  }, [contacts, pendingScores]);

  const clusterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: contacts.length };
    for (const c of ALL_CLUSTERS) counts[c] = 0;
    for (const rc of contacts) {
      const cl = clusterOf(rc.contact);
      if (cl) counts[cl] = (counts[cl] ?? 0) + 1;
    }
    return counts;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = effectiveScores.filter(({ contact, score: s }) => {
      if (view === "tier1" && !selectedIds.has(contact.id)) return false;
      if (view === "untagged" && s !== null) return false;

      if (activeCluster !== "all") {
        if (clusterOf(contact) !== activeCluster) return false;
      }

      if (q) {
        const hay = [contact.name, contact.title ?? "", ...(contact.emails ?? [])]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortMode === "byScore") {
      // Sort by computed score desc; unscored go to the bottom. Stable
      // tiebreak on name asc keeps the order deterministic.
      return [...rows].sort((a, b) => {
        const aHas = a.score !== null;
        const bHas = b.score !== null;
        if (aHas !== bHas) return aHas ? -1 : 1;
        const sa = score(a.score?.recency, a.score?.seniority, a.score?.fit, weights);
        const sb = score(b.score?.recency, b.score?.seniority, b.score?.fit, weights);
        if (sb !== sa) return sb - sa;
        return a.contact.name.localeCompare(b.contact.name);
      });
    }

    return rows;
  }, [effectiveScores, view, selectedIds, activeCluster, search, sortMode, weights]);

  const recruiterRows = useMemo(
    () => filtered.filter((row) => isRecruiterContact(row)),
    [filtered]
  );
  const contactRows = useMemo(
    () => filtered.filter((row) => !isRecruiterContact(row)),
    [filtered]
  );

  // ---- Mutations ----------------------------------------------------------

  const setPip = useCallback(
    (contactId: string, key: keyof PendingScore, value: number) => {
      const baseRc = contacts.find((rc) => rc.contact.id === contactId);
      const baseScore = pendingScores[contactId] ??
        (baseRc?.score
          ? {
              recency: baseRc.score.recency,
              seniority: baseRc.score.seniority,
              fit: baseRc.score.fit,
            }
          : { recency: 0, seniority: 0, fit: 0 });
      const next: PendingScore = { ...baseScore, [key]: value };
      setPendingScores((prev) => ({ ...prev, [contactId]: next }));
      void upsertContactScore(
        contactId,
        next.recency || 1,
        next.seniority || 1,
        next.fit || 1
      );
    },
    [contacts, pendingScores]
  );

  const toggleSelect = useCallback(
    (contactId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(contactId)) {
          next.delete(contactId);
        } else {
          // 30 is now a soft goal, not a hard cap. Let users select more so the
          // gate purely lives on "at least 1" for Finish.
          next.add(contactId);
        }
        return next;
      });
    },
    []
  );

  const handleAutoRank = useCallback(() => {
    const picks = autoRank(effectiveScores, strategy, weights, TARGET_SIZE);
    setSelectedIds(new Set(picks.map((p) => p.contactId)));
    setAutoOrder(picks.map((p) => p.contactId));
    setSortMode("byScore");
  }, [effectiveScores, strategy, weights]);

  const handleFinish = useCallback(() => {
    if (selectedIds.size === 0) return;

    // Build picks. If auto-rank produced an ordering, use it; otherwise rank
    // by score desc.
    const orderIds = autoOrder ?? null;
    const picksOrder: string[] = orderIds
      ? orderIds.filter((id) => selectedIds.has(id))
      : [...selectedIds].sort((a, b) => {
          const sa = effectiveScores.find((rc) => rc.contact.id === a)?.score;
          const sb = effectiveScores.find((rc) => rc.contact.id === b)?.score;
          return (
            score(sb?.recency, sb?.seniority, sb?.fit, weights) -
            score(sa?.recency, sa?.seniority, sa?.fit, weights)
          );
        });

    const picks = picksOrder.map((cid, i) => {
      const rc = effectiveScores.find((r) => r.contact.id === cid)!;
      const s = rc.score;
      const cluster = clusterOf(rc.contact);
      const clusterLbl = cluster ? CLUSTER_LABEL[cluster] : "Other";
      return {
        contactId: cid,
        rank: i + 1,
        priorityScore: score(s?.recency, s?.seniority, s?.fit, weights),
        whyNow: `${clusterLbl} · last touch ${daysAgoLabel(
          rc.contact.last_touch_date
        )} · fit ${s?.fit ?? 0}/5`,
        title: rc.contact.name,
        subtitle: [rc.contact.title].filter(Boolean).join(" · "),
      };
    });

    startFinish(async () => {
      const result = await finishTier1(picks);
      if (!result.ok) {
        setFinishStatus(`Error: ${result.error ?? "unknown"}`);
        return;
      }
      setFinishStatus(
        `Saved ${result.upserted} picks · ${result.dismissed} dismissed`
      );
      setTimeout(() => setFinishStatus(null), 4000);
    });
  }, [autoOrder, effectiveScores, selectedIds, weights]);

  // ---- Render -------------------------------------------------------------

  const selectedCount = selectedIds.size;
  const progress = Math.min(1, selectedCount / TARGET_SIZE);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Add anyone you want to stay in touch with on a regular cadence, or run
            the Tier 1 Reconnect Ranker over a bulk import to score the network
            and auto-promote the top 30 to ActionQueue.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setAddContactOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add contact
          </Button>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">
              <span className={cn("font-mono text-sm", selectedCount === TARGET_SIZE ? "text-sky-400" : "text-foreground")}>
                {selectedCount}
              </span>
              <span className="mx-1">/</span>
              <span className="font-mono text-sm">{TARGET_SIZE}</span>
              <span className="ml-1.5">selected</span>
            </span>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-sky-400 transition-all"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {!configured ? (
        <NotConfiguredBanner />
      ) : null}

      {contacts.length === 0 && configured ? (
        <EmptyState onImport={() => setImportOpen(true)} />
      ) : (
        <>
          <WeightsCard weights={weights} onChange={setWeights} />

          <StrategyExplainer strategy={strategy} />

          <ControlsRow
            search={search}
            onSearch={setSearch}
            strategy={strategy}
            onStrategy={setStrategy}
            onAutoRank={handleAutoRank}
            onImport={() => setImportOpen(true)}
            onFinish={handleFinish}
            isFinishing={isFinishing}
            finishEnabled={selectedCount > 0}
            selectedCount={selectedCount}
            finishStatus={finishStatus}
          />

          <ClusterChips
            counts={clusterCounts}
            active={activeCluster}
            onSelect={setActiveCluster}
          />

          <ViewToolbar view={view} onView={setView} />

          <RankerSection
            title="Recruiters"
            description="Search, talent, and recruiter contacts."
            rows={recruiterRows}
            open={recruitersOpen}
            onToggle={() => setRecruitersOpen((value) => !value)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSetPip={setPip}
            weights={weights}
            emptyMessage="No recruiters match the current filters."
          />

          <RankerSection
            title="Contacts"
            description="Everyone else in the network."
            rows={contactRows}
            open={contactsOpen}
            onToggle={() => setContactsOpen((value) => !value)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSetPip={setPip}
            weights={weights}
            emptyMessage="No non-recruiter contacts match the current filters."
          />
        </>
      )}

      <CandidateImport open={importOpen} onOpenChange={setImportOpen} />
      <ContactCreateModal
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
      />
    </div>
  );
}

// ==========================================================================
// Sub-components
// ==========================================================================

function NotConfiguredBanner() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <strong className="font-semibold">Read-only preview.</strong> Supabase
        env vars (<code>NEXT_PUBLIC_SUPABASE_URL</code> +{" "}
        <code>SUPABASE_SERVICE_ROLE_KEY</code>) aren&apos;t set on this
        deployment. The page renders, but reads return empty and writes are
        no-ops until the project env is configured.
      </div>
    </div>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-12 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground/60" />
      <div>
        <h2 className="text-sm font-semibold">No contacts yet</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Bring in candidates from a CSV (LinkedIn export, HubSpot, manual
          list). Add an alumni cluster column for instant balancing.
        </p>
      </div>
      <Button size="sm" onClick={onImport}>
        Import candidates
      </Button>
    </div>
  );
}

function WeightsCard({
  weights,
  onChange,
}: {
  weights: RankerWeights;
  onChange: (w: RankerWeights) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Scoring weights
        </h2>
        <code className="text-[11px] text-muted-foreground">
          score = {weights.rec}·rec + {weights.sen}·sen + {weights.fit}·fit
        </code>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <WeightSlider
          label="Recency"
          value={weights.rec}
          onChange={(v) => onChange({ ...weights, rec: v })}
        />
        <WeightSlider
          label="Seniority"
          value={weights.sen}
          onChange={(v) => onChange({ ...weights, sen: v })}
        />
        <WeightSlider
          label="Fit"
          value={weights.fit}
          onChange={(v) => onChange({ ...weights, fit: v })}
        />
      </div>
    </div>
  );
}

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <Slider
        min={0}
        max={5}
        step={1}
        value={[value]}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : v;
          onChange(next ?? 0);
        }}
      />
    </div>
  );
}

function StrategyExplainer({ strategy }: { strategy: RankStrategy }) {
  const info = STRATEGY_INFO[strategy];
  return (
    <div className="rounded-lg border border-sky-400/30 bg-sky-400/5 px-3 py-2 text-xs">
      <span className="font-semibold text-sky-300">{info.label}.</span>{" "}
      <span className="text-muted-foreground">{info.description}</span>
    </div>
  );
}

function ControlsRow({
  search,
  onSearch,
  strategy,
  onStrategy,
  onAutoRank,
  onImport,
  onFinish,
  isFinishing,
  finishEnabled,
  selectedCount,
  finishStatus,
}: {
  search: string;
  onSearch: (s: string) => void;
  strategy: RankStrategy;
  onStrategy: (s: RankStrategy) => void;
  onAutoRank: () => void;
  onImport: () => void;
  onFinish: () => void;
  isFinishing: boolean;
  finishEnabled: boolean;
  selectedCount: number;
  finishStatus: string | null;
}) {
  const pickWord = selectedCount === 1 ? "pick" : "picks";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name, title, email…"
          className="h-8 pl-7 text-xs"
        />
      </div>

      <Select value={strategy} onValueChange={(v) => onStrategy(v as RankStrategy)}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="Strategy" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="topscore">Top score</SelectItem>
          <SelectItem value="balanced">Cluster-balanced</SelectItem>
          <SelectItem value="fresh">Fresh-first</SelectItem>
        </SelectContent>
      </Select>

      <Button size="sm" onClick={onAutoRank} className="h-8 gap-1.5">
        <ArrowDownUp className="h-3.5 w-3.5" />
        Auto-rank
      </Button>

      <Button size="sm" variant="outline" onClick={onImport} className="h-8">
        Import contacts
      </Button>

      <div className="flex items-center gap-2">
        {finishStatus ? (
          <span className="text-[11px] text-muted-foreground">{finishStatus}</span>
        ) : null}
        <Button
          size="sm"
          onClick={onFinish}
          disabled={!finishEnabled || isFinishing}
          className="h-8 gap-1.5 bg-sky-500 hover:bg-sky-400 text-white"
        >
          {isFinishing ? (
            <>Saving…</>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Finish &amp; save {selectedCount} {pickWord}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ClusterChips({
  counts,
  active,
  onSelect,
}: {
  counts: Record<string, number>;
  active: AlumniCluster | "all";
  onSelect: (c: AlumniCluster | "all") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ChipButton
        label={`All (${counts.all ?? 0})`}
        active={active === "all"}
        cls={CLUSTER_CHIP.all}
        onClick={() => onSelect("all")}
      />
      {ALL_CLUSTERS.map((c) => (
        <ChipButton
          key={c}
          label={`${CLUSTER_LABEL[c]} (${counts[c] ?? 0})`}
          active={active === c}
          cls={CLUSTER_CHIP[c]}
          onClick={() => onSelect(c)}
        />
      ))}
    </div>
  );
}

function ChipButton({
  label,
  active,
  cls,
  onClick,
}: {
  label: string;
  active: boolean;
  cls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] transition-colors",
        cls,
        active ? "ring-2 ring-offset-1 ring-offset-background ring-sky-400" : "opacity-90 hover:opacity-100"
      )}
    >
      {label}
    </button>
  );
}

function ViewToolbar({
  view,
  onView,
}: {
  view: ViewMode;
  onView: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border bg-card p-0.5 text-[11px]">
      {(
        [
          { id: "all", label: "All" },
          { id: "tier1", label: "Tier 1 only" },
          { id: "untagged", label: "Untagged" },
        ] as Array<{ id: ViewMode; label: string }>
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onView(opt.id)}
          className={cn(
            "rounded px-2 py-1 transition-colors",
            view === opt.id
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RankerSection({
  title,
  description,
  rows,
  open,
  onToggle,
  selectedIds,
  onToggleSelect,
  onSetPip,
  weights,
  emptyMessage,
}: {
  title: string;
  description: string;
  rows: RankableContact[];
  open: boolean;
  onToggle: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSetPip: (id: string, key: "recency" | "seniority" | "fit", v: number) => void;
  weights: RankerWeights;
  emptyMessage: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 border-b bg-muted/20 px-3 py-2 text-left transition-colors hover:bg-muted/35"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <h2 className="text-xs font-semibold uppercase tracking-wide">
              {title}
            </h2>
            <span className="font-mono rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
              {rows.length}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
        </div>
      </button>

      {open ? (
        <RankerTable
          rows={rows}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onSetPip={onSetPip}
          weights={weights}
          emptyMessage={emptyMessage}
        />
      ) : null}
    </section>
  );
}

function RankerTable({
  rows,
  selectedIds,
  onToggleSelect,
  onSetPip,
  weights,
  emptyMessage,
}: {
  rows: RankableContact[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSetPip: (id: string, key: "recency" | "seniority" | "fit", v: number) => void;
  weights: RankerWeights;
  emptyMessage: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2 text-left"></th>
              <th className="px-2 py-2 text-left">Contact</th>
              <th className="px-2 py-2 text-left">Cluster</th>
              <th className="px-2 py-2 text-left">Last contact</th>
              <th className="px-2 py-2 text-left">Recency</th>
              <th className="px-2 py-2 text-left">Seniority</th>
              <th className="px-2 py-2 text-left">Fit</th>
              <th className="px-2 py-2 text-right">Score</th>
              <th className="px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-10 text-center text-xs text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((rc) => (
                <ContactRow
                  key={rc.contact.id}
                  rc={rc}
                  selected={selectedIds.has(rc.contact.id)}
                  onToggleSelect={onToggleSelect}
                  onSetPip={onSetPip}
                  weights={weights}
                />
              ))
            )}
          </tbody>
      </table>
    </div>
  );
}

function ContactRow({
  rc,
  selected,
  onToggleSelect,
  onSetPip,
  weights,
}: {
  rc: RankableContact;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onSetPip: (id: string, key: "recency" | "seniority" | "fit", v: number) => void;
  weights: RankerWeights;
}) {
  const cluster = clusterOf(rc.contact);
  const clusterCls = cluster ? CLUSTER_CHIP[cluster] : CLUSTER_CHIP.other;
  const clusterLbl = cluster ? CLUSTER_LABEL[cluster] : "—";
  const tier = lastTouchTier(rc.contact.last_touch_date);
  const s = rc.score;
  const computed = score(s?.recency, s?.seniority, s?.fit, weights);
  const breakdown = scoreBreakdown(s?.recency, s?.seniority, s?.fit, weights);
  const [sendPending, startSend] = useTransition();
  const [sentToTriage, setSentToTriage] = useState(false);

  const handleSendToTriage = () => {
    startSend(async () => {
      const result = await sendContactToTriage({ contactId: rc.contact.id });
      if (!result.ok) {
        toast.error(result.error);
      } else if (result.alreadyExists) {
        setSentToTriage(true);
        toast.info("Already in your triage queue");
      } else {
        setSentToTriage(true);
        toast.success("Sent to Triage queue");
      }
    });
  };

  return (
    <tr
      className={cn(
        "border-t border-border/60 transition-colors",
        selected ? TIER_BG : "hover:bg-muted/30"
      )}
    >
      <td className="px-2 py-2 align-top">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(rc.contact.id)}
          aria-label={`Select ${rc.contact.name} for tier 1`}
        />
      </td>
      <td className="px-2 py-2 align-top">
        <div className="font-medium leading-tight">{rc.contact.name}</div>
        {rc.contact.title ? (
          <div className="text-[11px] text-muted-foreground">{rc.contact.title}</div>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {rc.contact.company?.name ? (
            <span className="text-[11px] text-muted-foreground">
              {rc.contact.company.name}
            </span>
          ) : (
            <Badge variant="destructive" className="h-4 rounded-full px-1.5 text-[10px]">
              Missing company
            </Badge>
          )}
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        <Badge variant="outline" className={cn("rounded-full text-[10px]", clusterCls)}>
          {clusterLbl}
        </Badge>
      </td>
      <td className="px-2 py-2 align-top">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className={cn("h-1.5 w-1.5 rounded-full", RECENCY_TIER_DOT[tier])} />
          <span className="text-muted-foreground">
            {daysAgoLabel(rc.contact.last_touch_date)}
          </span>
        </div>
      </td>
      <PipsCell
        value={s?.recency ?? 0}
        onSet={(v) => onSetPip(rc.contact.id, "recency", v)}
        labelPrefix={`Recency for ${rc.contact.name}`}
      />
      <PipsCell
        value={s?.seniority ?? 0}
        onSet={(v) => onSetPip(rc.contact.id, "seniority", v)}
        labelPrefix={`Seniority for ${rc.contact.name}`}
      />
      <PipsCell
        value={s?.fit ?? 0}
        onSet={(v) => onSetPip(rc.contact.id, "fit", v)}
        labelPrefix={`Fit for ${rc.contact.name}`}
      />
      <td
        className="px-2 py-2 text-right align-top font-mono tabular-nums"
        title={breakdown}
      >
        {s ? computed : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-2 py-2 text-right align-top">
        {!selected ? (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleSendToTriage}
            disabled={sendPending || sentToTriage}
            aria-label={`Send ${rc.contact.name} to triage`}
            title={sentToTriage ? "Already in your triage queue" : "Send to Triage"}
          >
            <Inbox className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

function PipsCell({
  value,
  onSet,
  labelPrefix,
}: {
  value: number;
  onSet: (v: number) => void;
  labelPrefix: string;
}) {
  return (
    <td className="px-2 py-2 align-top">
      <div className="inline-flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onSet(n === value ? 0 : n)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSet(n);
                }
              }}
              aria-label={`${labelPrefix}: ${n}`}
              className={cn(
                "h-3 w-3 rounded-full border transition-colors",
                filled
                  ? "border-sky-400 bg-sky-400"
                  : "border-border hover:border-sky-400/60 hover:bg-sky-400/20"
              )}
            />
          );
        })}
      </div>
    </td>
  );
}

function isRecruiterContact(row: RankableContact) {
  const tags = row.contact.tags ?? [];
  return tags.some((tag) => {
    const normalized = tag.trim().toLowerCase();
    return (
      normalized === "recruiter" ||
      normalized === "origin:recruiter" ||
      normalized === "source:recruiter" ||
      normalized.startsWith("firm:")
    );
  });
}

export type { Props as Tier1RankerPageProps };
