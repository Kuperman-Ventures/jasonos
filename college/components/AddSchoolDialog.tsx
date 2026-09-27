"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { School } from "@/lib/types";

type SearchHit = {
  id: number;
  name: string;
  city: string;
  state: string;
};

type ExistingMatch = {
  id: string;
  name: string;
  archived: boolean;
};

export function AddSchoolDialog({
  schools,
  onClose,
  onOpen,
  onAdded,
}: {
  schools: School[];
  onClose: () => void;
  onOpen: (schoolId: string) => void;
  onAdded: (school: School) => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [existing, setExisting] = useState<ExistingMatch | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError("");
    const timer = window.setTimeout(() => {
      void fetch(`/api/schools/search?q=${encodeURIComponent(q)}`)
        .then(async (response) => {
          const body = (await response.json().catch(() => ({}))) as {
            results?: SearchHit[];
            error?: string;
          };
          if (cancelled) return;
          if (!response.ok) {
            setResults([]);
            setSearchError(body.error || "Search failed");
            return;
          }
          setResults(body.results ?? []);
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setSearchError("Search failed");
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!selected) {
      setExisting(null);
      setAddError("");
      return;
    }
    const match = schools.find((school) => school.unitId === selected.id) ?? null;
    setExisting(
      match
        ? { id: match.id, name: match.name, archived: match.archived }
        : null,
    );
    setAddError("");
  }, [selected, schools]);

  async function addSelected() {
    if (!selected || adding || existing) return;
    setAdding(true);
    setAddError("");
    try {
      const response = await fetch("/api/schools/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: selected.id }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        school?: School;
        error?: string;
        existing?: ExistingMatch;
      };
      if (response.status === 409 && body.existing) {
        setExisting(body.existing);
        return;
      }
      if (!response.ok || !body.school) {
        setAddError(body.error || "Could not add school");
        return;
      }
      onAdded(body.school);
      onClose();
    } catch {
      setAddError("Could not add school");
    } finally {
      setAdding(false);
    }
  }

  async function restoreExisting() {
    if (!existing?.archived || restoring) return;
    setRestoring(true);
    setAddError("");
    try {
      const response = await fetch("/api/schools/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: selected?.id, restore: true }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        school?: School;
        error?: string;
      };
      if (!response.ok || !body.school) {
        setAddError(body.error || "Could not restore school");
        return;
      }
      onAdded(body.school);
      onClose();
    } catch {
      setAddError("Could not restore school");
    } finally {
      setRestoring(false);
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
        className="tl-dialog add-school-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="tl-dlg-head">
          <div>
            <div className="tl-kicker mono">College list</div>
            <h2 id={titleId}>Add school</h2>
            <p className="section-sub">
              Search College Scorecard, then add by unit ID so research can attach later.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="stack-field add-school-search">
          <span className="label">School name</span>
          <input
            ref={inputRef}
            className="field"
            type="search"
            value={query}
            placeholder="Type a school name"
            aria-label="Search schools"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
            }}
          />
        </label>

        <div className="add-school-results" role="listbox" aria-label="Search results">
          {searching ? <p className="section-sub">Searching…</p> : null}
          {searchError ? <p className="add-school-error">{searchError}</p> : null}
          {!searching && !searchError && query.trim().length >= 2 && results.length === 0 ? (
            <p className="section-sub">No matching schools.</p>
          ) : null}
          {results.map((hit) => {
            const label = [hit.city, hit.state].filter(Boolean).join(", ");
            const active = selected?.id === hit.id;
            return (
              <button
                key={hit.id}
                type="button"
                role="option"
                aria-selected={active}
                className={["add-school-result", active ? "active" : ""].filter(Boolean).join(" ")}
                onClick={() => setSelected(hit)}
              >
                <span className="add-school-result-name">{hit.name}</span>
                {label ? <span className="add-school-result-loc"> — {label}</span> : null}
              </button>
            );
          })}
        </div>

        {existing ? (
          <div className="add-school-existing">
            <p>
              Already on your list:{" "}
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  onOpen(existing.id);
                  onClose();
                }}
              >
                {existing.name}
              </button>
              {existing.archived ? " (archived)" : ""}
            </p>
            {existing.archived ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={restoring}
                onClick={() => void restoreExisting()}
              >
                {restoring ? "Restoring…" : "Restore"}
              </button>
            ) : null}
          </div>
        ) : null}

        {addError ? <p className="add-school-error">{addError}</p> : null}

        <div className="add-school-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selected || Boolean(existing) || adding}
            onClick={() => void addSelected()}
          >
            {adding ? "Adding…" : "Add school"}
          </button>
        </div>
      </div>
    </div>
  );
}
