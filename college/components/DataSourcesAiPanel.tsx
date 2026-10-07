"use client";

import { useId, useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
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
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className={open ? "ds-ai is-open" : "ds-ai"} aria-labelledby="ds-ai-title">
      <button
        type="button"
        className="ds-ai-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <CaretDown weight="bold" size={14} aria-hidden="true" />
        ) : (
          <CaretRight weight="bold" size={14} aria-hidden="true" />
        )}
        <span className="ds-ai-toggle-copy">
          <span id="ds-ai-title" className="ds-ai-toggle-title">
            Where AI is used
          </span>
          <span className="ds-ai-toggle-meta">
            {open
              ? "Hide details"
              : "3 model jobs · Gateway + Perplexity · collapsed"}
          </span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className="ds-ai-body">
          <p className="ds-ai-lede">
            Three places call a model through Vercel AI Gateway. On the diagram, nodes and
            features tagged AI are the same paths. Click a row to open that source.
          </p>

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
        </div>
      ) : null}
    </section>
  );
}
