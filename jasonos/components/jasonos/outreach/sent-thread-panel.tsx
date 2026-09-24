"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSentEmailThread } from "@/lib/server-actions/sent-followups";
import type { SentThreadMessageView } from "@/lib/server-actions/sent-followups";
import { cn } from "@/lib/utils";

function formatWhen(raw: string): string {
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return raw;
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SentThreadPanel({
  followupId,
  gmailUrl,
}: {
  followupId: string;
  gmailUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SentThreadMessageView[] | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || messages || loading) return;
    setLoading(true);
    const result = await getSentEmailThread(followupId);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMessages(result.messages);
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => void toggle()}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {open ? "Hide thread" : "Show thread"}
      </button>
      {open ? (
        <div className="mt-2 space-y-2 rounded-md border bg-background/50 p-3">
          <a
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Open in Gmail
            <ExternalLink className="h-3 w-3" />
          </a>
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading the thread…
            </p>
          ) : null}
          {messages?.length === 0 ? (
            <p className="text-xs text-muted-foreground">This thread is empty.</p>
          ) : null}
          {messages?.map((msg) => (
            <article
              key={msg.id}
              className={cn(
                "rounded-md border px-3 py-2",
                msg.fromMe ? "border-foreground/15 bg-muted/40" : "border-border"
              )}
            >
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{msg.from}</span>
                {msg.date ? ` · ${formatWhen(msg.date)}` : ""}
              </p>
              {msg.to ? (
                <p className="truncate text-[11px] text-muted-foreground">To {msg.to}</p>
              ) : null}
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{msg.body || "(no body)"}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
