"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  prepareSchoolResearchUpdates,
  type ResearchApplyPatch,
  type ResearchPreviewRow,
} from "@/lib/research";
import type { School } from "@/lib/types";

export function PasteUpdateDialog({
  schools,
  onClose,
  onApply,
}: {
  schools: School[];
  onClose: () => void;
  onApply: (updates: ResearchApplyPatch[]) => Promise<void> | void;
}) {
  const titleId = useId();
  const [raw, setRaw] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [patches, setPatches] = useState<ResearchApplyPatch[]>([]);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: ResearchPreviewRow[] = useMemo(
    () => patches.flatMap((patch) => patch.rows),
    [patches],
  );

  function preview() {
    setApplyError("");
    const trimmed = raw.trim();
    if (!trimmed) {
      setProblems(["Paste a school-research JSON object or array"]);
      setPatches([]);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      setProblems(["Paste valid JSON"]);
      setPatches([]);
      return;
    }
    const result = prepareSchoolResearchUpdates(parsed, schools);
    if (!result.ok) {
      setProblems(result.problems);
      setPatches([]);
      return;
    }
    setProblems([]);
    setPatches(result.patches);
  }

  async function apply() {
    if (!patches.length || applying) return;
    setApplying(true);
    setApplyError("");
    try {
      await onApply(patches);
      onClose();
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "Could not apply updates");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      className="tl-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="tl-dialog paste-update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="tl-dlg-head">
          <div>
            <div className="tl-kicker mono">Research</div>
            <h2 id={titleId}>Paste update</h2>
            <p className="section-sub">
              Paste school-research JSON (one object or an array). Preview field changes, then apply.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="stack-field">
          <span className="label">JSON</span>
          <textarea
            className="field paste-update-json"
            rows={10}
            value={raw}
            placeholder='{"updateType":"school-research","unitId":168148,...}'
            aria-label="School research JSON"
            onChange={(event) => {
              setRaw(event.target.value);
              setPatches([]);
              setProblems([]);
              setApplyError("");
            }}
          />
        </label>

        <div className="paste-update-actions">
          <button type="button" className="btn btn-secondary" onClick={preview}>
            Preview
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!patches.length || applying}
            onClick={() => void apply()}
          >
            {applying ? "Applying…" : "Apply updates"}
          </button>
        </div>

        {problems.length ? (
          <ul className="paste-update-problems">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
        {applyError ? <p className="add-school-error">{applyError}</p> : null}

        {rows.length ? (
          <div className="table-wrap paste-update-preview">
            <table className="schools">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Field</th>
                  <th>Current</th>
                  <th>New</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.schoolId}:${row.field}:${row.next}`}>
                    <td>{row.schoolName}</td>
                    <td>
                      <code>{row.field}</code>
                    </td>
                    <td>{row.current}</td>
                    <td>{row.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
