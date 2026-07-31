"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  searchContactsForEmailTemplate,
  type EmailTemplateContactHit,
} from "@/lib/server-actions/email-templates";

// Type-ahead contact picker shared by the Email Builder (and available for the
// Templates flow). Searches JasonOS contacts and surfaces whether an email is
// on file.
export function ContactPicker({
  onSelect,
  autoFocus = true,
}: {
  onSelect: (c: EmailTemplateContactHit) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmailTemplateContactHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      setSearching(true);
      searchContactsForEmailTemplate(query, 24)
        .then((r) => {
          if (!cancelled) setResults(r);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 pl-8 text-sm"
          placeholder="Search contacts by name…"
          autoFocus={autoFocus}
        />
      </div>

      <div className="max-h-80 overflow-y-auto rounded-md border bg-background/40">
        {searching && results.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </div>
        ) : results.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No matches. Add the person with Add contact in the top nav, then
            come back.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {r.name}
                      {r.firm ? (
                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                          · {r.firm}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.email ?? "No email on file"}
                      {r.title ? ` · ${r.title}` : ""}
                    </p>
                  </div>
                  {!r.email ? (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-amber-300">
                      Needs email
                    </span>
                  ) : (
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
