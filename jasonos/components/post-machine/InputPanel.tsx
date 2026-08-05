"use client";

import type { InputMode } from "@/lib/post-machine/types";

type InputPanelProps = {
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  idea: string;
  onIdeaChange: (value: string) => void;
  topic: string;
  onTopicChange: (value: string) => void;
  guidance: string;
  onGuidanceChange: (value: string) => void;
  onContinueIdea: () => void;
  onRunResearch: () => void;
  loading?: boolean;
  error?: string | null;
};

export function InputPanel({
  mode,
  onModeChange,
  idea,
  onIdeaChange,
  topic,
  onTopicChange,
  guidance,
  onGuidanceChange,
  onContinueIdea,
  onRunResearch,
  loading,
  error,
}: InputPanelProps) {
  const canContinueIdea = Boolean(idea.trim()) && !loading;
  const canRunResearch = Boolean(topic.trim()) && !loading;

  return (
    <section className="pm-panel">
      <h2 className="pm-section-title">Start</h2>
      <p className="pm-section-sub">
        Bring a rough idea you already have, or research a topic first and turn
        the findings into hooks.
      </p>

      <div className="pm-mode-toggle" role="tablist" aria-label="Input mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "idea"}
          className="pm-mode-btn"
          data-active={mode === "idea"}
          onClick={() => onModeChange("idea")}
          disabled={loading}
        >
          Quick Idea
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "research"}
          className="pm-mode-btn"
          data-active={mode === "research"}
          onClick={() => onModeChange("research")}
          disabled={loading}
        >
          Research a topic
        </button>
      </div>

      {mode === "idea" ? (
        <>
          <label className="pm-label" htmlFor="pm-idea">
            Idea input
          </label>
          <textarea
            id="pm-idea"
            className="pm-textarea"
            value={idea}
            onChange={(e) => onIdeaChange(e.target.value)}
            placeholder="e.g. Most fractional CMOs sell activity. The ones who stick sell architecture — and founders only feel that when the pipeline math breaks..."
            disabled={loading}
          />
          <div className="pm-actions">
            <button
              type="button"
              className="pm-btn"
              onClick={onContinueIdea}
              disabled={!canContinueIdea}
            >
              Continue to voice dials
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="pm-label" htmlFor="pm-topic">
            Topic
          </label>
          <input
            id="pm-topic"
            className="pm-input"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="e.g. AI in fractional CMO work"
            disabled={loading}
          />

          <label className="pm-label" htmlFor="pm-guidance" style={{ marginTop: "1.1rem" }}>
            Guidance / angle
          </label>
          <textarea
            id="pm-guidance"
            className="pm-textarea"
            style={{ minHeight: "120px" }}
            value={guidance}
            onChange={(e) => onGuidanceChange(e.target.value)}
            placeholder="e.g. Look for where practitioners disagree on whether AI replaces or augments strategy work"
            disabled={loading}
          />

          {error ? <p className="pm-error">{error}</p> : null}

          <div className="pm-actions">
            <button
              type="button"
              className="pm-btn"
              onClick={onRunResearch}
              disabled={!canRunResearch}
            >
              {loading ? "Researching…" : "Run research"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
