"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowsClockwise, Graph, ListBullets, X } from "@phosphor-icons/react";
import type { DataSource, Feature } from "@/lib/data-sources";
import type { DataSourcesPayload } from "@/lib/data-sources-server";
import {
  DS_FILTERS,
  FEATURE_LABELS,
  formatCheckedAt,
  matchesFilter,
  type DsFilter,
} from "@/lib/data-sources-view";
import { useViewportMode } from "@/lib/use-viewport-mode";
import { DataSourceDrawer } from "./DataSourceDrawer";
import { DataSourcesAiPanel } from "./DataSourcesAiPanel";
import { DataSourcesDiagram } from "./DataSourcesDiagram";
import { DataSourcesList } from "./DataSourcesList";

type View = "diagram" | "list";

const VIEW_STORAGE_KEY = "track.dataSources.view";

const LEGEND: { tone: string; label: string }[] = [
  { tone: "ok", label: "Working or current" },
  { tone: "stale", label: "Stale or untested" },
  { tone: "failing", label: "Failing" },
  { tone: "nodate", label: "No date recorded" },
];

const VIEW_EVENT = "track:data-sources-view";

function readStoredView(): View | null {
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return raw === "diagram" || raw === "list" ? raw : null;
  } catch {
    return null;
  }
}

function writeStoredView(view: View) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(VIEW_EVENT));
}

function subscribeStoredView(onChange: () => void) {
  window.addEventListener(VIEW_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(VIEW_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

async function fetchPayload(): Promise<DataSourcesPayload> {
  const response = await fetch("/api/data-sources");
  const body = (await response.json()) as DataSourcesPayload & { error?: string };
  if (!response.ok) throw new Error(body.error || "Could not load data sources");
  return body;
}

export function DataSourcesTab() {
  const viewport = useViewportMode();
  const [data, setData] = useState<DataSourcesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const storedView = useSyncExternalStore(subscribeStoredView, readStoredView, () => null);
  const [filter, setFilter] = useState<DsFilter>("All");
  const [feature, setFeature] = useState<Feature | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchPayload()
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load data sources");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const view: View = storedView ?? (viewport === "mobile" ? "list" : "diagram");

  function chooseView(next: View) {
    writeStoredView(next);
  }

  async function checkAll() {
    setChecking(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/data-sources/check-all", { method: "POST" });
      const body = (await response.json()) as DataSourcesPayload & {
        error?: string;
        summary?: { tested: number; failed: number; skipped: number };
      };
      if (!response.ok) throw new Error(body.error || "Check all failed");
      setData(body);
      if (body.summary) {
        const { tested, failed, skipped } = body.summary;
        setNotice(
          `Checked ${tested} source${tested === 1 ? "" : "s"}` +
            (failed ? `, ${failed} failed` : ", all passed") +
            (skipped ? `, ${skipped} skipped for time` : "") +
            ".",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check all failed");
    } finally {
      setChecking(false);
    }
  }

  const sources = useMemo(() => data?.sources ?? [], [data]);
  const matches = useCallback((s: DataSource) => matchesFilter(s, filter), [filter]);
  const listSources = useMemo(
    () => sources.filter((s) => matches(s) && (!feature || s.feeds.includes(feature))),
    [sources, matches, feature],
  );
  const selected = sources.find((s) => s.id === selectedId) ?? null;
  const closeDrawer = useCallback(() => setSelectedId(null), []);

  return (
    <section className="ds-page">
      <header className="ds-head">
        <span className="ds-eyebrow">Reference</span>
        <div className="ds-title-row">
          <h2>Data Sources</h2>
          {data ? (
            <>
              <span className="ds-count">{sources.length} sources</span>
              <button type="button" className="ds-attention" onClick={() => setFilter("Needs attention")}>
                {data.needAttention} need attention
              </button>
              <span className="ds-count">Last checked {formatCheckedAt(data.lastCheckedAt)}</span>
            </>
          ) : null}
          {data?.canEdit ? (
            <button type="button" className="ds-check-all" disabled={checking} onClick={() => void checkAll()}>
              <ArrowsClockwise weight="duotone" size={18} aria-hidden="true" className={checking ? "ds-spin" : undefined} />
              {checking ? "Checking…" : "Check all"}
            </button>
          ) : null}
        </div>
        <p className="ds-blurb">
          Where every number in the app comes from: live APIs, dated snapshots checked into the repo, link-outs,
          and the calendar feed we send out. Pick a feature to see what feeds it; click any source for details.
          AI paths are marked on the diagram; expand Where AI is used for the full how and review notes.
        </p>
      </header>

      <DataSourcesAiPanel
        selectedId={selectedId}
        onSelect={setSelectedId}
        onFeature={setFeature}
      />

      <div className="ds-controls">
        <div className="ds-view-toggle" role="group" aria-label="View">
          {(
            [
              ["diagram", "Diagram", Graph],
              ["list", "List", ListBullets],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              className={view === id ? "is-on" : undefined}
              onClick={() => chooseView(id)}
            >
              <Icon weight="duotone" size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div className="ds-filters" role="group" aria-label="Filter">
          <span className="ds-filter-label">Filter</span>
          {DS_FILTERS.map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={filter === label}
              className={filter === label ? "ds-filter is-on" : "ds-filter"}
              onClick={() => setFilter(label)}
            >
              {label}
            </button>
          ))}
        </div>
        {feature ? (
          <button type="button" className="ds-feature-clear" onClick={() => setFeature(null)}>
            Showing {FEATURE_LABELS[feature]}
            <X weight="duotone" size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="ds-legend">
        {LEGEND.map((row) => (
          <span key={row.tone}>
            <span className={`ds-dot ds-dot--${row.tone}`} aria-hidden="true" />
            {row.label}
          </span>
        ))}
        <span>
          <span className="ds-ai-mark" aria-hidden="true">
            AI
          </span>
          Model path (Gateway or Perplexity)
        </span>
      </div>

      {notice ? <p className="ds-notice">{notice}</p> : null}
      {error ? (
        <p className="ds-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading && !data ? <p className="ds-empty">Loading data sources…</p> : null}

      {data && view === "diagram" ? (
        <DataSourcesDiagram
          sources={sources}
          matches={matches}
          feature={feature}
          onFeature={setFeature}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      ) : null}
      {data && view === "list" ? (
        <DataSourcesList sources={listSources} selectedId={selectedId} onSelect={setSelectedId} />
      ) : null}

      {selected && data ? (
        <DataSourceDrawer
          key={selected.id}
          source={selected}
          canEdit={data.canEdit}
          schools={data.schools}
          linkOverrides={data.linkOverrides}
          onClose={closeDrawer}
          onFeature={(f) => setFeature(f)}
          onPayload={setData}
        />
      ) : null}
    </section>
  );
}
