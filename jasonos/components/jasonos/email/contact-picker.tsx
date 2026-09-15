"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import {
  searchContactsForEmailTemplate,
  type EmailTemplateContactHit,
} from "@/lib/server-actions/email-templates";

// Type-ahead contact picker shared by Email Templates and the Email Builder.
// Searches JasonOS contacts and surfaces whether an email is on file.
// "Needs email" opens that person's Contact info editor so you can add one
// without leaving the compose flow.
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
  const [editContact, setEditContact] = useState<EmailTemplateContactHit | null>(
    null
  );

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

  const openContactCard = (c: EmailTemplateContactHit) => {
    setEditContact(c);
  };

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
            No matches. Add the person from Outreach → Queue (Add contact), then
            come back.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {results.map((r) => (
              <li key={r.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => (r.email ? onSelect(r) : openContactCard(r))}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/40"
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
                  {r.email ? (
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </button>
                {!r.email ? (
                  <button
                    type="button"
                    onClick={() => openContactCard(r)}
                    title="Open their contact card and add an email"
                    className="shrink-0 px-3 py-2.5 text-[10px] uppercase tracking-wider text-amber-300 underline decoration-amber-300/60 underline-offset-2 transition-colors hover:bg-amber-300/10 hover:text-amber-200"
                  >
                    Needs email
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <OutreachModal
        open={!!editContact}
        onOpenChange={(open) => {
          if (open) return;
          const id = editContact?.id;
          setEditContact(null);
          void searchContactsForEmailTemplate(query, 24).then((rows) => {
            setResults(rows);
            const updated = id ? rows.find((r) => r.id === id) : undefined;
            if (updated?.email) onSelect(updated);
          });
        }}
        contactId={editContact?.id}
        initialDisplay={
          editContact
            ? {
                name: editContact.name,
                title: editContact.title,
                firm: editContact.firm,
              }
            : undefined
        }
        initialTab="contact"
        initialIdentityEditing
      />
    </div>
  );
}
