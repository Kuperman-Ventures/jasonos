"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DataSource, Feature, SourceType } from "@/lib/data-sources";
import {
  DIAGRAM_HEIGHT,
  DIAGRAM_WIDTH,
  FEATURES,
  chipY,
  diagramLines,
  diagramPositions,
  nodeMeta,
  statusTone,
  worstStatus,
} from "@/lib/data-sources-view";

type Props = {
  sources: DataSource[];
  matches: (source: DataSource) => boolean;
  feature: Feature | null;
  onFeature: (feature: Feature | null) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const COLUMN_LABELS: { type: SourceType; label: string; left: number; top: number }[] = [
  { type: "live", label: "Live", left: 0, top: 84 },
  { type: "snapshot", label: "Snapshots", left: 1030, top: 84 },
  { type: "linkout", label: "Link-outs", left: 0, top: 686 },
  { type: "outbound", label: "Outbound", left: 1030, top: 686 },
];

export function DataSourcesDiagram({ sources, matches, feature, onFeature, selectedId, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? DIAGRAM_WIDTH;
      setScale(Math.max(0.5, Math.min(1, width / DIAGRAM_WIDTH)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const positions = useMemo(() => diagramPositions(sources), [sources]);
  const lines = useMemo(() => diagramLines(sources), [sources]);
  const byId = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const platform = sources.filter((s) => s.type === "platform");
  const active = hoverId ?? selectedId;
  const activeSource = active ? byId.get(active) ?? null : null;
  const anyOn = Boolean(active || feature);
  const now = new Date();

  function nodeState(s: DataSource) {
    const dim = !matches(s) || (feature != null && !s.feeds.includes(feature));
    const highlighted = active === s.id || (feature != null && s.feeds.includes(feature) && !dim);
    return { dim, highlighted, selected: selectedId === s.id };
  }

  function nodeClass(base: string, s: DataSource) {
    const st = nodeState(s);
    return [
      base,
      st.dim ? "is-dim" : "",
      st.highlighted ? "is-highlighted" : "",
      st.selected ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const hoverProps = (id: string) => ({
    onMouseEnter: () => setHoverId(id),
    onMouseLeave: () => setHoverId((current) => (current === id ? null : current)),
    onFocus: () => setHoverId(id),
    onBlur: () => setHoverId((current) => (current === id ? null : current)),
  });

  const platformOn = activeSource?.type === "platform";

  return (
    <div ref={wrapRef} className="ds-diagram-wrap" style={{ height: DIAGRAM_HEIGHT * scale }}>
      <div
        className="ds-diagram"
        style={{ width: DIAGRAM_WIDTH, height: DIAGRAM_HEIGHT, transform: `scale(${scale})` }}
      >
        <svg
          className="ds-lines"
          width={DIAGRAM_WIDTH}
          height={DIAGRAM_HEIGHT}
          viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
          aria-hidden="true"
        >
          {lines.map((line) => {
            const source = byId.get(line.sourceId)!;
            const on = (feature != null && feature === line.feature && matches(source)) || active === line.sourceId;
            const opacity = on ? 1 : anyOn ? 0.12 : matches(source) ? 0.45 : 0.12;
            return (
              <path
                key={line.key}
                d={line.d}
                className={on ? "ds-line is-on" : "ds-line"}
                strokeDasharray={line.dashed ? "4 4" : undefined}
                opacity={opacity}
              />
            );
          })}
          <path d="M660 56 L660 110" className={platformOn ? "ds-line is-on" : "ds-line"} opacity={platformOn ? 1 : 0.45} />
        </svg>

        <div className="ds-platform-row">
          <span className="ds-col-label ds-platform-label">Platform</span>
          {platform.map((s) => (
            <button
              key={s.id}
              type="button"
              className={nodeClass("ds-node ds-node--platform", s)}
              onClick={() => onSelect(s.id)}
              {...hoverProps(s.id)}
            >
              <span className={`ds-dot ds-dot--${statusTone(s.status)}`} aria-hidden="true" />
              <span className="ds-node-name">{s.name}</span>
              {s.subtitle ? <span className="ds-node-sub">{s.subtitle}</span> : null}
              <span className="sr-only">{s.statusLabel}</span>
            </button>
          ))}
        </div>

        {COLUMN_LABELS.map((col) => (
          <span key={col.type} className="ds-col-label" style={{ left: col.left, top: col.top }}>
            {col.label} · {sources.filter((s) => s.type === col.type).length}
          </span>
        ))}

        <div className="ds-app-card">
          <div className="ds-app-title">Kyle College</div>
          <div className="ds-app-sub">{FEATURES.length} features · select one</div>
        </div>

        {FEATURES.map((f, i) => {
          const feeding = sources.filter((s) => s.type !== "platform" && s.feeds.includes(f.id));
          const on = feature === f.id;
          const lit = Boolean(activeSource?.feeds.includes(f.id));
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              className={["ds-chip", on ? "is-on" : "", lit ? "is-lit" : "", feature && !on ? "is-faded" : ""]
                .filter(Boolean)
                .join(" ")}
              style={{ top: chipY(i) }}
              onClick={() => onFeature(on ? null : f.id)}
            >
              <span className={`ds-dot ds-dot--${statusTone(worstStatus(feeding))}`} aria-hidden="true" />
              <span className="ds-chip-name">{f.name}</span>
              <span className="ds-chip-count">{feeding.length}</span>
            </button>
          );
        })}

        {sources
          .filter((s) => positions[s.id])
          .map((s) => {
            const p = positions[s.id]!;
            return (
              <button
                key={s.id}
                type="button"
                className={nodeClass("ds-node", s)}
                style={{ left: p.x, top: p.y, width: p.w }}
                onClick={() => onSelect(s.id)}
                title={`${s.name}: ${s.statusLabel}`}
                {...hoverProps(s.id)}
              >
                <span className={`ds-dot ds-dot--${statusTone(s.status)}`} aria-hidden="true" />
                <span className="ds-node-name">{s.name}</span>
                <span className="ds-node-meta">{nodeMeta(s, now)}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
