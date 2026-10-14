"use client";

import { ChevronDown, Plus } from "lucide-react";
import type { RefObject } from "react";
import { LibraryRow } from "@/components/jasonos/library/library-row";
import { SearchInput } from "@/components/ui/search-input";
import type { LibraryChannel } from "@/lib/library/text";
import { libraryCountLabel } from "@/lib/library/text";
import type { LibraryItem } from "@/lib/server-actions/library";
import { cn } from "@/lib/utils";

const CHANNELS: { id: LibraryChannel | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "email", label: "Email" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "text", label: "Text" },
];

function RailSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative inline-flex max-w-full">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 max-w-full appearance-none truncate rounded-[2px] border-0 border-b-2 border-[var(--color-neutral-400)] bg-[var(--jos-surface)] pr-7 pl-2.5 text-[13px] font-medium text-[var(--jos-ink)] outline-none"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-[var(--jos-ink)]"
        aria-hidden
      />
    </label>
  );
}

export function LibraryRail({
  search,
  onSearchChange,
  searchBoxRef,
  channel,
  onChannelChange,
  counts,
  contactId,
  contactOptions,
  onContactChange,
  company,
  companyOptions,
  onCompanyChange,
  kind,
  kindOptions,
  onKindChange,
  sort,
  onSortChange,
  total,
  shownCount,
  filtered,
  onClearFilters,
  items,
  query,
  selectedId,
  onSelect,
  onAdd,
  emptyLibrary,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchBoxRef: RefObject<HTMLDivElement | null>;
  channel: LibraryChannel | "all";
  onChannelChange: (channel: LibraryChannel | "all") => void;
  counts: Record<LibraryChannel | "all", number>;
  contactId: string;
  contactOptions: { value: string; label: string }[];
  onContactChange: (id: string) => void;
  company: string;
  companyOptions: string[];
  onCompanyChange: (value: string) => void;
  kind: string;
  kindOptions: string[];
  onKindChange: (value: string) => void;
  sort: "newest" | "copied";
  onSortChange: (sort: "newest" | "copied") => void;
  total: number;
  shownCount: number;
  filtered: boolean;
  onClearFilters: () => void;
  items: LibraryItem[];
  query: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  emptyLibrary: boolean;
}) {
  return (
    <aside className="flex w-full min-w-0 flex-col gap-3.5 min-[900px]:sticky min-[900px]:top-4 min-[900px]:max-h-[calc(100dvh-2rem)] min-[900px]:w-[var(--jos-rail-w)] min-[900px]:shrink-0">
      <div ref={searchBoxRef}>
        <SearchInput
          value={search}
          onValueChange={onSearchChange}
          placeholder="Search messages, people, companies"
          aria-label="Search the library"
          iconClassName="left-3 size-5 text-[var(--jos-muted)]"
          inputClassName="h-10 rounded-[2px] border-0 border-b-2 border-[var(--color-neutral-400)] bg-[var(--jos-surface)] pr-9 pl-10 text-[16px] shadow-none placeholder:text-[var(--jos-muted)]"
          onKeyDown={(event) => {
            if (event.key === "Escape" && search) {
              event.preventDefault();
              event.stopPropagation();
              onSearchChange("");
            }
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Channel">
        {CHANNELS.map((chip) => {
          const selected = channel === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChannelChange(chip.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-[5px] text-[14px] font-semibold",
                selected
                  ? "bg-[var(--jos-ink)] text-[var(--jos-bg)]"
                  : "bg-[var(--jos-surface)] text-[var(--jos-ink)]"
              )}
            >
              {chip.label}
              <span className="font-medium tabular-nums">{counts[chip.id]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <RailSelect
          label="All contacts"
          value={contactId}
          onChange={onContactChange}
          options={contactOptions}
        />
        <RailSelect
          label="All companies"
          value={company}
          onChange={onCompanyChange}
          options={companyOptions.map((name) => ({ value: name, label: name }))}
        />
        <RailSelect
          label="All kinds"
          value={kind}
          onChange={onKindChange}
          options={kindOptions.map((name) => ({ value: name, label: name }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[var(--jos-muted)]">
        <p className="tabular-nums">{libraryCountLabel(total, shownCount, filtered)}</p>
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            aria-pressed={sort === "newest"}
            onClick={() => onSortChange("newest")}
            className={cn(sort === "newest" ? "font-semibold text-[var(--jos-ink)]" : "hover:text-[var(--jos-ink)]")}
          >
            Newest
          </button>
          <span aria-hidden>·</span>
          <button
            type="button"
            aria-pressed={sort === "copied"}
            onClick={() => onSortChange("copied")}
            className={cn(sort === "copied" ? "font-semibold text-[var(--jos-ink)]" : "hover:text-[var(--jos-ink)]")}
          >
            Most copied
          </button>
        </div>
        {filtered ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="font-medium text-[var(--jos-action)] hover:text-[var(--jos-action-hover)]"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t-2 border-[var(--jos-ink)]">
        {items.length === 0 ? (
          <p className="px-1 py-4 text-[15px] text-[var(--jos-muted)] italic">
            {emptyLibrary
              ? "Nothing in the library yet. Add the first message."
              : "No messages match."}
          </p>
        ) : (
          items.map((item) => (
            <LibraryRow
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              query={query}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-[2px] bg-[var(--jos-action)] text-[15px] font-semibold text-white hover:bg-[var(--jos-action-hover)]"
      >
        <Plus className="size-5" aria-hidden />
        Add to library
      </button>
    </aside>
  );
}
