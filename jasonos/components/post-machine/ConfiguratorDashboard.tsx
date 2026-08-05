"use client";

import {
  LINKEDIN_LENGTHS,
  TARGET_READERS,
  type ConfiguratorState,
  type LinkedInLength,
  type TargetReader,
} from "@/lib/post-machine/types";

type ConfiguratorDashboardProps = {
  config: ConfiguratorState;
  onChange: (next: ConfiguratorState) => void;
  onBack: () => void;
  onGenerateHooks: () => void;
  loading?: boolean;
  error?: string | null;
};

const DIALS: {
  key: keyof Pick<
    ConfiguratorState,
    | "directness"
    | "contrarian"
    | "dataDensity"
    | "architectFraming"
    | "costOfWaiting"
  >;
  label: string;
  hint: string;
}[] = [
  {
    key: "directness",
    label: "Directness / Anti-fluff",
    hint: "Blunt vs. diplomatic",
  },
  {
    key: "contrarian",
    label: "Contrarian edge",
    hint: "Push consensus vs. play it safe",
  },
  {
    key: "dataDensity",
    label: "Data density",
    hint: "Metrics & placeholders",
  },
  {
    key: "architectFraming",
    label: "Architect framing",
    hint: "Operator vs. generic advisor",
  },
  {
    key: "costOfWaiting",
    label: "Cost-of-waiting intensity",
    hint: "Inaction as costly vs. informational",
  },
];

export function ConfiguratorDashboard({
  config,
  onChange,
  onBack,
  onGenerateHooks,
  loading,
  error,
}: ConfiguratorDashboardProps) {
  function setDial(
    key: (typeof DIALS)[number]["key"],
    value: number
  ) {
    onChange({ ...config, [key]: value });
  }

  return (
    <section className="pm-panel">
      <h2 className="pm-section-title">Voice & framing</h2>
      <p className="pm-section-sub">
        These dials shape every generation call. Tune them before you ask for
        hooks.
      </p>

      <div className="pm-grid-dials">
        {DIALS.map((dial) => (
          <div className="pm-dial" key={dial.key}>
            <div className="pm-dial-head">
              <div>
                <div className="pm-dial-name">{dial.label}</div>
                <div style={{ color: "var(--pm-muted)", fontSize: "0.85rem" }}>
                  {dial.hint}
                </div>
              </div>
              <span className="pm-dial-value">{config[dial.key]}/5</span>
            </div>
            <input
              className="pm-range"
              type="range"
              min={1}
              max={5}
              step={1}
              value={config[dial.key]}
              onChange={(e) => setDial(dial.key, Number(e.target.value))}
              disabled={loading}
              aria-label={dial.label}
            />
          </div>
        ))}
      </div>

      <div className="pm-grid-selects">
        <div>
          <label className="pm-label" htmlFor="pm-reader">
            Target reader
          </label>
          <select
            id="pm-reader"
            className="pm-select"
            value={config.targetReader}
            onChange={(e) =>
              onChange({
                ...config,
                targetReader: e.target.value as TargetReader,
              })
            }
            disabled={loading}
          >
            {TARGET_READERS.map((reader) => (
              <option key={reader} value={reader}>
                {reader}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="pm-label" htmlFor="pm-length">
            LinkedIn length target
          </label>
          <select
            id="pm-length"
            className="pm-select"
            value={config.linkedinLength}
            onChange={(e) =>
              onChange({
                ...config,
                linkedinLength: e.target.value as LinkedInLength,
              })
            }
            disabled={loading}
          >
            {LINKEDIN_LENGTHS.map((length) => (
              <option key={length.value} value={length.value}>
                {length.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="pm-error">{error}</p> : null}

      <div className="pm-actions">
        <button
          type="button"
          className="pm-btn pm-btn-ghost"
          onClick={onBack}
          disabled={loading}
        >
          Back
        </button>
        <button
          type="button"
          className="pm-btn"
          onClick={onGenerateHooks}
          disabled={loading}
        >
          {loading ? "Generating hooks…" : "Generate 3 hooks"}
        </button>
      </div>
    </section>
  );
}
