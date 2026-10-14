"use client";

import type { Ref } from "react";
import { Building2, Mail, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { LinkedInIcon } from "@/components/jasonos/library/linkedin-icon";
import { CopyButton, type CopyButtonHandle } from "@/components/jasonos/library/copy-button";
import { Highlight } from "@/components/jasonos/library/highlight";
import { buildMailtoUrl } from "@/lib/email-templates/render";
import { formatCopyLine, formatSentOnLong } from "@/lib/library/text";
import type { LibraryContact, LibraryItem } from "@/lib/server-actions/library";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ICONS = {
  email: Mail,
  linkedin: LinkedInIcon,
  text: MessageSquare,
} as const;

const LABELS = {
  email: "Email",
  linkedin: "LinkedIn",
  text: "Text",
} as const;

function MetaLabel({ children }: { children: string }) {
  return (
    <div className="text-[12px] font-bold tracking-[0.1em] text-[var(--jos-muted)] uppercase">
      {children}
    </div>
  );
}

export function LibraryDetail({
  item,
  query,
  emptyLibrary,
  copyRef,
  onCopied,
  onEdit,
  onDelete,
  onOpenContact,
}: {
  item: LibraryItem | null;
  query: string;
  emptyLibrary: boolean;
  copyRef: Ref<CopyButtonHandle>;
  onCopied: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenContact: (contact: LibraryContact) => void;
}) {
  if (!item) {
    return (
      <section className="min-w-0 w-full max-w-[780px] flex-1">
        <p className="text-[15px] text-[var(--jos-muted)] italic">
          {emptyLibrary
            ? "Nothing in the library yet. Add the first message."
            : "No messages match."}
        </p>
      </section>
    );
  }

  const Icon = ICONS[item.channel];

  async function draftEmail() {
    const to = item?.contacts[0]?.email ?? "";
    const subject = item?.subject ?? "";
    const body = item?.body ?? "";
    const full = buildMailtoUrl({ to, subject, body });
    if (full.length > 8000) {
      let copied = false;
      try {
        await navigator.clipboard.writeText(body);
        copied = true;
      } catch {
        const el = document.getElementById("library-message-body");
        if (el) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
      window.location.href = buildMailtoUrl({ to, subject, body: "" });
      toast.success(
        copied
          ? "Message copied. Paste it into the Mail draft."
          : "Mail opened without the message. Copy failed, so select the text and paste it."
      );
      return;
    }
    window.location.href = full;
    toast.success("Opening Mail… finish the send there.");
  }

  return (
    <section className="flex min-w-0 w-full max-w-[780px] flex-1 flex-col gap-[22px]">
      <div>
        {item.kind ? (
          <p className="text-[13px] font-bold tracking-[0.14em] text-[var(--jos-muted)] uppercase">
            {item.kind}
          </p>
        ) : null}
        <h2 className="mt-1 text-[30px] leading-[1.15] font-extrabold tracking-[-0.02em] break-words text-[var(--jos-ink)]">
          {item.title}
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        <dl className="flex flex-wrap gap-x-10 gap-y-5">
          <div>
            <MetaLabel>Sent to</MetaLabel>
            {item.contacts.length === 0 ? (
              <p className="mt-1 text-[16px] font-semibold text-[var(--jos-muted)]">None</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2.5">
                {item.contacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => onOpenContact(contact)}
                    className="text-left text-[16px] font-semibold text-[var(--jos-action)] hover:text-[var(--jos-action-hover)]"
                  >
                    {contact.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <MetaLabel>Channel</MetaLabel>
            <div className="mt-1 flex items-center gap-1.5 text-[16px] font-semibold text-[var(--jos-ink)]">
              <Icon
                className={cn(
                  "size-5",
                  item.channel === "email" ? "text-[var(--color-email)]" : "text-[var(--jos-ink)]"
                )}
                aria-hidden
              />
              {LABELS[item.channel]}
            </div>
          </div>
          <div>
            <MetaLabel>Company</MetaLabel>
            {item.company ? (
              <div className="mt-1 flex items-center gap-1.5 text-[16px] font-semibold text-[var(--jos-ink)]">
                <Building2 className="size-5 shrink-0" aria-hidden />
                <span className="break-words">{item.company}</span>
              </div>
            ) : (
              <p className="mt-1 text-[16px] font-semibold text-[var(--jos-muted)]">None</p>
            )}
          </div>
          <div>
            <MetaLabel>Sent on</MetaLabel>
            <p className="mt-1 text-[16px] font-semibold text-[var(--jos-ink)] tabular-nums">
              {formatSentOnLong(item.sentOn)}
            </p>
          </div>
        </dl>
        <p className="text-[13px] text-[var(--jos-muted)]">
          {formatCopyLine(item.copyCount, item.lastCopiedAt)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <CopyButton
          ref={copyRef}
          text={item.body}
          idleLabel="Copy message"
          selectOnFail="library-message-body"
          onCopied={() => onCopied(item.id)}
        />
        <button
          type="button"
          onClick={() => void draftEmail()}
          className="inline-flex h-10 items-center gap-2 rounded-[2px] border border-[var(--jos-ink)] bg-transparent px-4 text-[15px] font-medium text-[var(--jos-ink)] hover:bg-[var(--jos-surface)]"
        >
          <Mail className="size-5 text-[var(--color-email)]" aria-hidden />
          Draft email
        </button>
        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[var(--jos-action)] hover:text-[var(--jos-action-hover)]"
          >
            <Pencil className="size-5" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="ml-2.5 inline-flex items-center gap-1.5 text-[15px] font-medium text-[var(--jos-muted)] hover:text-[var(--color-accent-2-text)]"
          >
            <Trash2 className="size-5" aria-hidden />
            Delete
          </button>
        </div>
      </div>

      {item.channel === "email" && item.subject ? (
        <div className="flex items-baseline gap-3.5 border-t-2 border-[var(--jos-ink)] pt-3">
          <div className="text-[12px] font-bold tracking-[0.1em] text-[var(--jos-muted)]">
            SUBJECT
          </div>
          <div className="min-w-0 flex-1 text-[16px] font-semibold break-words text-[var(--jos-ink)]">
            <Highlight text={item.subject} query={query} />
          </div>
          <CopyButton tone="ghost" text={item.subject} idleLabel="Copy subject" />
        </div>
      ) : null}

      <div
        id="library-message-body"
        className="rounded-[2px] bg-[var(--jos-surface)] px-7 py-6 text-[16px] leading-[1.6] break-words whitespace-pre-wrap text-[var(--jos-ink)]"
      >
        <Highlight text={item.body} query={query} />
      </div>
    </section>
  );
}
