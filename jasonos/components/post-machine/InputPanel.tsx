"use client";

type InputPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onContinue: () => void;
  disabled?: boolean;
};

export function InputPanel({
  value,
  onChange,
  onContinue,
  disabled,
}: InputPanelProps) {
  return (
    <section className="pm-panel">
      <h2 className="pm-section-title">Quick Idea</h2>
      <p className="pm-section-sub">
        Dump a rough thought — bullets, a stat, an observation, a half-formed
        argument. No structure required.
      </p>

      <label className="pm-label" htmlFor="pm-idea">
        Idea input
      </label>
      <textarea
        id="pm-idea"
        className="pm-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Most fractional CMOs sell activity. The ones who stick sell architecture — and founders only feel that when the pipeline math breaks..."
        disabled={disabled}
      />

      <div className="pm-actions">
        <button
          type="button"
          className="pm-btn"
          onClick={onContinue}
          disabled={disabled || !value.trim()}
        >
          Continue to voice dials
        </button>
      </div>
    </section>
  );
}
