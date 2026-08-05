"use client";

import type { Hook } from "@/lib/post-machine/types";

type HookPickerProps = {
  hooks: Hook[];
  selectedId: string | null;
  onSelect: (hook: Hook) => void;
  onBack: () => void;
  onContinue: () => void;
  loading?: boolean;
  error?: string | null;
};

export function HookPicker({
  hooks,
  selectedId,
  onSelect,
  onBack,
  onContinue,
  loading,
  error,
}: HookPickerProps) {
  return (
    <section className="pm-panel">
      <h2 className="pm-section-title">Pick a hook</h2>
      <p className="pm-section-sub">
        Same idea, three angles. Choose the opening that earns the scroll —
        full LinkedIn + blog drafts generate from that choice.
      </p>

      <div className="pm-hook-list">
        {hooks.map((hook) => (
          <button
            key={hook.id}
            type="button"
            className="pm-hook-card"
            data-selected={selectedId === hook.id}
            onClick={() => onSelect(hook)}
            disabled={loading}
          >
            <div className="pm-hook-angle">{hook.angle}</div>
            <div className="pm-hook-text">{hook.text}</div>
          </button>
        ))}
      </div>

      {error ? <p className="pm-error">{error}</p> : null}

      <div className="pm-actions">
        <button
          type="button"
          className="pm-btn pm-btn-ghost"
          onClick={onBack}
          disabled={loading}
        >
          Back to dials
        </button>
        <button
          type="button"
          className="pm-btn"
          onClick={onContinue}
          disabled={loading || !selectedId}
        >
          {loading ? "Writing drafts…" : "Generate LinkedIn + blog"}
        </button>
      </div>
    </section>
  );
}
