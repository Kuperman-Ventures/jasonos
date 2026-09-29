"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, PencilSimple, PlugsConnected, X } from "@phosphor-icons/react";
import type { DataSource, Feature } from "@/lib/data-sources";
import { VERCEL_ENV_WHERE } from "@/lib/data-sources";
import type { DataSourcesPayload } from "@/lib/data-sources-server";
import {
  FEATURES,
  FEATURE_LABELS,
  SOURCE_TYPE_LABELS,
  formatCheckedAt,
  statusTone,
} from "@/lib/data-sources-view";

type TestResult = { ok: boolean; ms: number | null; message: string };

type Props = {
  source: DataSource;
  canEdit: boolean;
  schools: { id: string; name: string }[];
  linkOverrides: Record<string, Record<string, string>>;
  onClose: () => void;
  onFeature: (feature: Feature) => void;
  onPayload: (payload: DataSourcesPayload) => void;
};

const KEY_LABELS = { set: "Set", missing: "Missing", not_needed: "Not needed" } as const;

/** Turn bare https URLs in setup hints into clickable links. */
function linkifyText(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ds-field">
      <span className="ds-field-label">{label}</span>
      {children}
    </div>
  );
}

function linkLabel(link: { schoolName?: string; url: string; status?: number | null }): string {
  const who = link.schoolName ? `${link.schoolName}: ` : "";
  const code = link.status ? ` (${link.status})` : "";
  return `${who}${link.url}${code}`;
}

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  try {
    return (await response.json()) as T & { error?: string };
  } catch {
    return { error: `Request failed (${response.status})` } as T & { error?: string };
  }
}

export function DataSourceDrawer({ source, canEdit, schools, linkOverrides, onClose, onFeature, onPayload }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState("");
  const [savingSetting, setSavingSetting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [overrideSchool, setOverrideSchool] = useState("");
  const [overrideUrl, setOverrideUrl] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const isLive = source.type === "live" || source.type === "platform";
  const isSnap = source.type === "snapshot";
  const isLink = source.type === "linkout";
  const isOut = source.type === "outbound";
  const overrides = linkOverrides[source.id] ?? {};

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!isOut) return;
    let cancelled = false;
    fetch("/api/calendar/subscribe")
      .then((r) => readJson<{ webcalUrl?: string }>(r))
      .then((body) => {
        if (!cancelled) setFeedUrl(body.webcalUrl ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOut]);

  async function runTest() {
    setTesting(true);
    setError("");
    setTestResult(null);
    try {
      const response = await fetch(`/api/data-sources/${encodeURIComponent(source.id)}/test`, { method: "POST" });
      const body = await readJson<DataSourcesPayload & { result?: TestResult }>(response);
      if (body.result) setTestResult(body.result);
      if (!response.ok && !body.result) throw new Error(body.error || "Test failed");
      if (body.sources) onPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function saveSetting(value: string) {
    setSavingSetting(true);
    setError("");
    try {
      const response = await fetch(`/api/data-sources/${encodeURIComponent(source.id)}/setting`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const body = await readJson<DataSourcesPayload>(response);
      if (!response.ok) throw new Error(body.error || "Could not save");
      onPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingSetting(false);
    }
  }

  async function saveOverride(schoolId: string, url: string) {
    if (!schoolId) {
      setError("Pick a school first.");
      return;
    }
    setSavingOverride(true);
    setError("");
    try {
      const response = await fetch(`/api/data-sources/${encodeURIComponent(source.id)}/override`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, url }),
      });
      const body = await readJson<DataSourcesPayload>(response);
      if (!response.ok) throw new Error(body.error || "Could not save");
      onPayload(body);
      setEditing(false);
      setOverrideUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingOverride(false);
    }
  }

  function copyFeed() {
    if (!feedUrl) return;
    navigator.clipboard?.writeText(feedUrl).catch(() => {});
    setCopied(true);
  }

  const usedBy =
    source.type === "platform" && source.feeds.length === FEATURES.length
      ? [{ id: null as Feature | null, name: "All features" }]
      : source.feeds.map((f) => ({ id: f as Feature | null, name: FEATURE_LABELS[f] }));
  const coverageMissing = source.coverage?.missing ?? [];
  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name ?? id;
  const testLabel = isLink ? "Check links" : "Test connection";

  return (
    <aside className="ds-drawer" aria-label={`${source.name} details`}>
      <div className="ds-drawer-head">
        <div className="ds-drawer-title">
          <span className="ds-eyebrow">{SOURCE_TYPE_LABELS[source.type]}</span>
          <span className="ds-drawer-name">{source.name}</span>
          {source.provider ? (
            <span className="ds-drawer-provider">
              {source.provider}
              {source.docsUrl ? (
                <>
                  {" · "}
                  <a href={source.docsUrl} target="_blank" rel="noreferrer">
                    Provider docs
                  </a>
                </>
              ) : null}
            </span>
          ) : null}
        </div>
        <button ref={closeRef} type="button" className="ds-icon-btn" aria-label="Close" onClick={onClose}>
          <X weight="duotone" size={20} aria-hidden="true" />
        </button>
      </div>

      <span className="ds-drawer-status">
        <span className={`ds-dot ds-dot--lg ds-dot--${statusTone(source.status)}`} aria-hidden="true" />
        {source.statusLabel}
      </span>

      {isLive ? (
        <>
          <Field label="Last successful call">
            <span className="ds-mono">{formatCheckedAt(source.lastSuccessAt)}</span>
          </Field>
          {source.lastErrorAt && source.lastErrorMessage ? (
            <Field label="Last error">
              <span className="ds-mono">{formatCheckedAt(source.lastErrorAt)}</span>
              <span className="ds-muted">{source.lastErrorMessage}</span>
            </Field>
          ) : null}
          <Field label="API key">
            <span className="ds-strong">{KEY_LABELS[source.apiKey]}</span>
            {source.apiKey === "not_needed" ? (
              <span className="ds-subtle">This source does not use a key of its own.</span>
            ) : (
              <>
                {source.envKeys.length > 0 ? (
                  <span className="ds-subtle">
                    Variable{source.envKeys.length > 1 ? "s" : ""}:{" "}
                    {source.envKeys.map((key, index) => (
                      <span key={key}>
                        {index > 0 ? " or " : ""}
                        <code className="ds-code">{key}</code>
                      </span>
                    ))}
                  </span>
                ) : null}
                <span className="ds-subtle">
                  Set in {VERCEL_ENV_WHERE}. Not editable here.
                </span>
                {source.setupHint ? (
                  <span className="ds-muted">{linkifyText(source.setupHint)}</span>
                ) : null}
                {source.apiKey === "missing" ? (
                  <span className="ds-broken">Key missing — add it in Vercel, then Test connection.</span>
                ) : null}
                {source.apiKey === "set" &&
                source.lastErrorMessage &&
                /invalid api_key|API_KEY_INVALID|rejected/i.test(source.lastErrorMessage) ? (
                  <span className="ds-broken">
                    The stored key was rejected. Fix or delete it in Vercel (details above).
                  </span>
                ) : null}
              </>
            )}
          </Field>
        </>
      ) : null}

      <Field label={isOut ? "Built from" : "Used by"}>
        <div className="ds-chip-row">
          {usedBy.map((u) => (
            <button
              key={u.name}
              type="button"
              className="ds-tag"
              onClick={() => u.id && onFeature(u.id)}
              disabled={!u.id}
            >
              {u.name}
            </button>
          ))}
        </div>
      </Field>

      {isLive && source.coverage ? (
        <Field label="Coverage">
          <span className="ds-mono">
            {source.coverage.have} {source.coverage.label ?? `of ${source.coverage.total} schools`}
          </span>
          <div className="ds-meter">
            <div
              className="ds-meter-fill"
              style={{ width: `${source.coverage.total ? Math.round((source.coverage.have / source.coverage.total) * 100) : 0}%` }}
            />
          </div>
        </Field>
      ) : null}

      {isLive && source.setting ? (
        <label className="ds-field">
          <span className="ds-field-label">{source.setting.label}</span>
          {canEdit ? (
            <select
              className="ds-select"
              value={source.setting.value}
              disabled={savingSetting}
              onChange={(event) => void saveSetting(event.target.value)}
            >
              {source.setting.options.map((option) => (
                <option key={option} value={option}>
                  {source.setting?.optionLabels?.[option] ?? option}
                </option>
              ))}
            </select>
          ) : (
            <span className="ds-strong">{source.setting.optionLabels?.[source.setting.value] ?? source.setting.value}</span>
          )}
        </label>
      ) : null}

      {isLive && source.notes ? (
        <Field label="Notes">
          <span className="ds-muted">{source.notes}</span>
        </Field>
      ) : null}

      {isSnap ? (
        <>
          <div className="ds-field-grid">
            <Field label="Imported">
              <span className="ds-mono">{source.importedAt ?? "Not recorded"}</span>
            </Field>
            <Field label="Data covers">
              <span>{source.dataCovers ?? "—"}</span>
            </Field>
          </div>
          {source.sourceLinks && source.sourceLinks.length > 0 ? (
            <Field label="Source links">
              {source.sourceLinks.map((link) =>
                link.url ? (
                  <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="ds-link">
                    {link.label}
                  </a>
                ) : (
                  <span key={link.label}>{link.label}</span>
                ),
              )}
            </Field>
          ) : null}
          {source.coverage ? (
            <Field label="Coverage">
              <span className="ds-mono">
                {source.coverage.have} {source.coverage.label ?? `of ${source.coverage.total} schools`}
              </span>
              <div className="ds-meter">
                <div
                  className="ds-meter-fill"
                  style={{ width: `${source.coverage.total ? Math.round((source.coverage.have / source.coverage.total) * 100) : 0}%` }}
                />
              </div>
              {coverageMissing.length > 0 && coverageMissing.length <= 12 ? (
                <span className="ds-subtle">Missing: {coverageMissing.join(", ")}</span>
              ) : null}
            </Field>
          ) : null}
          <Field label="Stale after">
            <span>{source.staleAfter ?? "—"}</span>
          </Field>
          {source.howToUpdate ? (
            <Field label="How to update">
              <code className="ds-code">{source.howToUpdate}</code>
            </Field>
          ) : null}
          {source.notes ? (
            <Field label="Notes">
              <span className="ds-muted">{source.notes}</span>
            </Field>
          ) : null}
          <Field label="History">
            {(source.history && source.history.length > 0
              ? source.history
              : [{ date: "—", note: "No previous imports recorded" }]
            ).map((h, i) => (
              <div key={`${h.date}-${i}`} className="ds-history-row">
                <span className="ds-mono">{h.date}</span>
                <span className="ds-muted">{h.note}</span>
              </div>
            ))}
          </Field>
        </>
      ) : null}

      {isLink ? (
        <>
          {source.notes ? (
            <Field label="URL pattern">
              <code className="ds-code">{source.notes}</code>
            </Field>
          ) : null}
          {source.coverage ? (
            <div className="ds-field-grid">
              <Field label="With a link">
                <span className="ds-figure">{source.coverage.have}</span>
              </Field>
              <Field label="Without">
                <span className="ds-figure">{source.coverage.total - source.coverage.have}</span>
              </Field>
            </div>
          ) : null}
          {coverageMissing.length > 0 ? (
            <Field label="No link yet">
              <span className="ds-muted">
                {coverageMissing.slice(0, 10).join(", ")}
                {coverageMissing.length > 10 ? `, + ${coverageMissing.length - 10} more` : ""}
              </span>
            </Field>
          ) : null}
          <Field label="Link check">
            <span className="ds-mono">{formatCheckedAt(source.lastCheckedAt)}</span>
            {(source.brokenLinks ?? []).map((b) => (
              <span key={b.url} className="ds-broken">
                Broken: {linkLabel(b)}
              </span>
            ))}
            {(source.blockedLinks ?? []).length > 0 ? (
              <span className="ds-subtle">
                {source.blockedLinks!.length} blocked the checker (likely fine in a browser):{" "}
                {source.blockedLinks!.slice(0, 5).map((b) => b.schoolName ?? b.url).join(", ")}
              </span>
            ) : null}
            {source.lastCheckedAt && (source.brokenLinks ?? []).length === 0 ? (
              <span className="ds-muted">No broken links</span>
            ) : null}
          </Field>
          {source.overrideAllowed ? (
            <Field label="Per-school override">
              {Object.keys(overrides).length > 0 ? (
                <ul className="ds-override-list">
                  {Object.entries(overrides).map(([schoolId, url]) => (
                    <li key={schoolId}>
                      <span className="ds-strong">{schoolName(schoolId)}</span>
                      <a href={url} target="_blank" rel="noreferrer" className="ds-link ds-break">
                        {url}
                      </a>
                      {canEdit ? (
                        <button
                          type="button"
                          className="ds-text-btn"
                          disabled={savingOverride}
                          onClick={() => void saveOverride(schoolId, "")}
                        >
                          Clear
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="ds-subtle">No overrides.</span>
              )}
              {canEdit && !editing ? (
                <button type="button" className="ds-outline-btn" onClick={() => setEditing(true)}>
                  <PencilSimple weight="duotone" size={16} aria-hidden="true" />
                  Edit URL
                </button>
              ) : null}
              {canEdit && editing ? (
                <div className="ds-override-form">
                  <select
                    className="ds-select"
                    value={overrideSchool}
                    onChange={(event) => {
                      setOverrideSchool(event.target.value);
                      setOverrideUrl(overrides[event.target.value] ?? "");
                    }}
                    aria-label="School"
                  >
                    <option value="">Pick a school…</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="ds-input"
                    placeholder="https://"
                    value={overrideUrl}
                    onChange={(event) => setOverrideUrl(event.target.value)}
                    aria-label="Override URL"
                  />
                  <div className="ds-row">
                    <button
                      type="button"
                      className="ds-primary-btn"
                      disabled={savingOverride}
                      onClick={() => void saveOverride(overrideSchool, overrideUrl)}
                    >
                      {savingOverride ? "Saving…" : "Save"}
                    </button>
                    <button type="button" className="ds-text-btn" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  </div>
                  <span className="ds-subtle">Leave the URL empty and save to clear an override.</span>
                </div>
              ) : null}
            </Field>
          ) : null}
        </>
      ) : null}

      {isOut ? (
        <>
          <Field label="Feed URL">
            <code className="ds-code ds-break">{feedUrl || (source.tokenStatus === "set" ? "Loading…" : "No token yet")}</code>
            {feedUrl ? (
              <button type="button" className="ds-outline-btn" onClick={copyFeed}>
                <Copy weight="duotone" size={16} aria-hidden="true" />
                {copied ? "Copied" : "Copy feed link"}
              </button>
            ) : null}
          </Field>
          {source.notes ? (
            <Field label="Includes">
              <span>{source.notes}</span>
            </Field>
          ) : null}
          <Field label="Last check">
            <span className="ds-mono">{formatCheckedAt(source.lastCheckedAt)}</span>
            {source.lastErrorAt && source.lastErrorMessage ? (
              <span className="ds-muted">{source.lastErrorMessage}</span>
            ) : null}
          </Field>
        </>
      ) : null}

      {canEdit && source.testable ? (
        <div className="ds-test-row">
          <button type="button" className="ds-outline-btn" disabled={testing} onClick={() => void runTest()}>
            <PlugsConnected weight="duotone" size={16} aria-hidden="true" />
            {testing ? "Testing…" : testLabel}
          </button>
          {testResult ? (
            <span className={testResult.ok ? "ds-test-result" : "ds-test-result is-error"}>
              {testResult.ok ? "Connected" : "Failed"}
              {testResult.ms != null ? ` · ${testResult.ms} ms` : ""} · {testResult.message}
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="ds-error" role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
