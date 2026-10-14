"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  searchContactsForEmailTemplate,
  type EmailTemplateContactHit,
} from "@/lib/server-actions/email-templates";
import type { LibraryContact } from "@/lib/server-actions/library";
import { cn } from "@/lib/utils";

export function LibraryContactPicker({
  value,
  onChange,
}: {
  value: LibraryContact[];
  onChange: (next: LibraryContact[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmailTemplateContactHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchContactsForEmailTemplate(trimmed, 8).then((rows) => {
        if (cancelled) return;
        setResults(rows.filter((row) => !value.some((contact) => contact.id === row.id)));
        setActive(0);
        setSearching(false);
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, value]);

  function add(hit: EmailTemplateContactHit) {
    if (value.some((contact) => contact.id === hit.id)) return;
    onChange([
      ...value,
      { id: hit.id, name: hit.name, email: hit.email, company: hit.firm },
    ]);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function move(delta: number) {
    if (results.length === 0) return;
    setActive((index) => Math.max(0, Math.min(results.length - 1, index + delta)));
  }

  const showMenu = open && query.trim().length > 0;

  return (
    <div className="relative" data-library-suggest="">
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-[2px] border-b-2 border-[var(--color-neutral-400)] bg-[var(--jos-surface)] px-2.5 py-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--jos-focus)]">
        {value.map((contact) => (
          <span
            key={contact.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--jos-ink)] py-0.5 pr-1.5 pl-3 text-[14px] font-semibold text-[var(--jos-bg)]"
          >
            {contact.name}
            <button
              type="button"
              aria-label={`Remove ${contact.name}`}
              onClick={() => onChange(value.filter((row) => row.id !== contact.id))}
              className="grid size-4 place-items-center"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (event.target.value.trim()) setSearching(true);
            else setSearching(false);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              move(1);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              move(-1);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const hit = results[active];
              if (hit) add(hit);
              return;
            }
            if (event.key === "Backspace" && query === "" && value.length > 0) {
              event.preventDefault();
              onChange(value.slice(0, -1));
              return;
            }
            if (event.key === "Escape") setOpen(false);
          }}
          aria-label="Search contacts to send to"
          placeholder={value.length === 0 ? "Search by name" : ""}
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-[16px] text-[var(--jos-ink)] outline-none placeholder:text-[var(--jos-muted)]"
        />
      </div>
      {showMenu ? (
        <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-20 overflow-hidden rounded-[2px] bg-[var(--jos-bg)] shadow-[var(--shadow-lg)]">
          {searching && results.length === 0 ? (
            <p className="px-3.5 py-2.5 text-[13px] text-[var(--jos-muted)]">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3.5 py-2.5 text-[13px] text-[var(--jos-muted)]">No matches.</p>
          ) : (
            results.map((hit, index) => (
              <button
                key={hit.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(hit)}
                className={cn(
                  "flex w-full items-baseline justify-between gap-3 px-3.5 py-2.5 text-left",
                  index === active && "bg-[var(--jos-surface)]"
                )}
              >
                <span className="truncate text-[15px] font-semibold text-[var(--jos-ink)]">
                  {hit.name}
                </span>
                <span className="truncate text-[13px] text-[var(--jos-muted)]">
                  {hit.firm ?? ""}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
