"use client";

import type { DataSource } from "@/lib/data-sources";
import {
  SOURCE_TYPE_LABELS,
  feedsLabel,
  formatCheckedAt,
  sortForList,
  statusTone,
} from "@/lib/data-sources-view";

function coversLabel(s: DataSource): string {
  if (s.dataCovers) return s.dataCovers;
  if (s.coverage) return `${s.coverage.have} of ${s.coverage.total} ${s.coverage.label ? s.coverage.label.replace(/^of \d+ /, "") : "schools"}`;
  return "—";
}

export function DataSourcesList({
  sources,
  selectedId,
  onSelect,
}: {
  sources: DataSource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const rows = sortForList(sources);
  const now = new Date();

  if (rows.length === 0) {
    return <p className="ds-empty">No sources match this filter.</p>;
  }

  return (
    <div className="ds-list" role="table" aria-label="Data sources">
      <div className="ds-list-head" role="row">
        <span role="columnheader">Source</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Feeds</span>
        <span role="columnheader">Imported</span>
        <span role="columnheader">Data covers</span>
        <span role="columnheader">Last check</span>
        <span role="columnheader">Status</span>
      </div>
      {rows.map((s) => (
        <button
          key={s.id}
          type="button"
          role="row"
          className={selectedId === s.id ? "ds-list-row is-selected" : "ds-list-row"}
          onClick={() => onSelect(s.id)}
        >
          <span role="cell" className="ds-list-name">
            {s.name}
          </span>
          <span role="cell" className="ds-list-muted" data-label="Type">
            {SOURCE_TYPE_LABELS[s.type]}
          </span>
          <span role="cell" className="ds-list-muted" data-label="Feeds">
            {feedsLabel(s)}
          </span>
          <span role="cell" className="ds-list-mono" data-label="Imported">
            {s.type === "snapshot" ? s.importedAt ?? "Not recorded" : "—"}
          </span>
          <span role="cell" className="ds-list-muted" data-label="Covers">
            {coversLabel(s)}
          </span>
          <span role="cell" className="ds-list-mono" data-label="Checked">
            {s.type === "snapshot" ? "—" : formatCheckedAt(s.lastCheckedAt, now)}
          </span>
          <span role="cell" className="ds-list-status">
            <span className={`ds-dot ds-dot--${statusTone(s.status)}`} aria-hidden="true" />
            {s.statusLabel}
          </span>
        </button>
      ))}
    </div>
  );
}
