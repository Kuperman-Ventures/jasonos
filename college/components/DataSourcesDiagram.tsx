"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DataSource, Feature, SourceType } from "@/lib/data-sources";
import {
  DIAGRAM_HEIGHT,
  DIAGRAM_WIDTH,
  FEATURES,
  aiDiagramCaption,
  chipY,
  diagramLines,
  diagramPositions,
  featureUsesAi,
  isAiSource,
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

const APP_COLUMN_TOP = 110;

export function DataSourcesDiagram({ sources, matches, feature, onFeature, selectedId, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverFeature, setHoverFeature] = useState<Feature | null>(null);

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
  /** Feature chip hover takes precedence over a sticky click selection. */
  const emphasizeFeature = hoverFeature ?? feature;
  const anyOn = Boolean(active || emphasizeFeature);
  const now = new Date();
  const caption = aiDiagramCaption({
    sourceId: activeSource && isAiSource(activeSource.id) ? activeSource.id : null,
    feature: emphasizeFeature && featureUsesAi(emphasizeFeature) ? emphasizeFeature : null,
  });

  function nodeState(s: DataSource) {
    const dim =
      !matches(s) ||
      (emphasizeFeature != null && !s.feeds.includes(emphasizeFeature));
    const highlighted =
      active === s.id ||
      (emphasizeFeature != null && s.feeds.includes(emphasizeFeature) && !dim);
    return { dim, highlighted, selected: selectedId === s.id };
  }

  function nodeClass(base: string, s: DataSource) {
    const st = nodeState(s);
    return [
      base,
      st.dim ? "is-dim" : "",
      st.highlighted ? "is-highlighted" : "",
      st.selected ? "is-selected" : "",
      isAiSource(s.id) ? "is-ai" : "",
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
  const aiLineOn =
    Boolean(activeSource && isAiSource(activeSource.id)) ||
    Boolean(emphasizeFeature && featureUsesAi(emphasizeFeature));

  return (
    <div className="ds-diagram-block">
      {/* Always rendered so show/hide does not shift the diagram under the cursor. */}
      <div
        className={caption ? "ds-ai-caption" : "ds-ai-caption is-empty"}
        role="status"
        aria-hidden={!caption}
      >
        {caption || "\u00a0"}
      </div>
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
            const on =
              active === line.sourceId ||
              (emphasizeFeature != null &&
                emphasizeFeature === line.feature &&
                matches(source));
            const aiEdge = isAiSource(line.sourceId);
            const opacity = on ? 1 : anyOn ? 0.12 : matches(source) ? 0.45 : 0.12;
            return (
              <path
                key={line.key}
                d={line.d}
                className={[
                  "ds-line",
                  on ? "is-on" : "",
                  aiEdge && on ? "is-ai" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                strokeDasharray={line.dashed ? "4 4" : aiEdge && on ? "5 4" : undefined}
                opacity={opacity}
              />
            );
          })}
          <path
            d="M660 56 L660 110"
            className={[
              "ds-line",
              platformOn || aiLineOn ? "is-on" : "",
              aiLineOn ? "is-ai" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            opacity={platformOn || aiLineOn ? 1 : 0.45}
          />
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
              {isAiSource(s.id) ? (
                <span className="ds-ai-mark" title="Uses a model">
                  AI
                </span>
              ) : null}
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

        <div className="ds-app-column">
          <div className="ds-app-card">
            <div className="ds-app-title">Kyle College</div>
            <div className="ds-app-sub">{FEATURES.length} features · select one</div>
          </div>

          {FEATURES.map((f, i) => {
            const feeding = sources.filter((s) => s.type !== "platform" && s.feeds.includes(f.id));
            const selected = feature === f.id;
            const lit =
              selected ||
              hoverFeature === f.id ||
              Boolean(activeSource?.feeds.includes(f.id));
            const faded = emphasizeFeature != null && emphasizeFeature !== f.id;
            const usesAi = featureUsesAi(f.id);
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={selected}
                className={[
                  "ds-chip",
                  selected ? "is-on" : "",
                  lit ? "is-lit" : "",
                  faded ? "is-faded" : "",
                  usesAi ? "is-ai" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ top: chipY(i) - APP_COLUMN_TOP }}
                onClick={() => onFeature(selected ? null : f.id)}
                onMouseEnter={() => setHoverFeature(f.id)}
                onMouseLeave={() =>
                  setHoverFeature((current) => (current === f.id ? null : current))
                }
                onFocus={() => setHoverFeature(f.id)}
                onBlur={() =>
                  setHoverFeature((current) => (current === f.id ? null : current))
                }
              >
                <span className={`ds-dot ds-dot--${statusTone(worstStatus(feeding))}`} aria-hidden="true" />
                <span className="ds-chip-name">{f.name}</span>
                {usesAi ? (
                  <span className="ds-ai-mark" title="Feature uses a model">
                    AI
                  </span>
                ) : null}
                <span className="ds-chip-count">{feeding.length}</span>
              </button>
            );
          })}
        </div>

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
                title={`${s.name}: ${s.statusLabel}${isAiSource(s.id) ? " · AI" : ""}`}
                {...hoverProps(s.id)}
              >
                <span className={`ds-dot ds-dot--${statusTone(s.status)}`} aria-hidden="true" />
                <span className="ds-node-name">{s.name}</span>
                {isAiSource(s.id) ? (
                  <span className="ds-ai-mark" title="Uses a model">
                    AI
                  </span>
                ) : null}
                <span className="ds-node-meta">{nodeMeta(s, now)}</span>
              </button>
            );
          })}

      </div>
    </div>
    </div>
  );
}
