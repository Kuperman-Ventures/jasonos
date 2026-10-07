"use client";

import type { Feature } from "@/lib/data-sources";
import {
  AI_WORKFLOW_BOUNDARIES,
  AI_WORKFLOW_USES,
  type AiWorkflowUse,
} from "@/lib/data-sources-view";

type Props = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFeature: (feature: Feature | null) => void;
};

function openUse(
  use: AiWorkflowUse,
  onSelect: (id: string) => void,
  onFeature: (feature: Feature | null) => void,
) {
  onFeature(use.feature);
  const primary = use.sourceIds[0];
  if (primary) onSelect(primary);
}

export function DataSourcesAiPanel({ selectedId, onSelect, onFeature }: Props) {
  return (
    <section className="ds-ai" aria-labelledby="ds-ai-title">
      <div className="ds-ai-head">
        <h3 id="ds-ai-title">Where AI is used</h3>
        <p>
          Three places call a model through Vercel AI Gateway. Click a row to open that source
          and highlight what it feeds.
        </p>
      </div>

      <ul className="ds-ai-list">
        {AI_WORKFLOW_USES.map((use) => {
          const active = use.sourceIds.includes(selectedId ?? "");
          return (
            <li key={use.id}>
              <button
                type="button"
                className={active ? "ds-ai-row is-on" : "ds-ai-row"}
                aria-pressed={active}
                onClick={() => openUse(use, onSelect, onFeature)}
              >
                <span className="ds-ai-row-title">{use.title}</span>
                <span className="ds-ai-row-where">{use.where}</span>
                <span className="ds-ai-row-how">
                  <strong>How:</strong> {use.how}
                </span>
                <span className="ds-ai-row-review">
                  <strong>Review:</strong> {use.review}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="ds-ai-bounds">
        <span className="ds-ai-bounds-label">What AI does not do</span>
        <ul>
          {AI_WORKFLOW_BOUNDARIES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
