"use client";

import { Sparkles, Star, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrackPill } from "./track-pill";
import { cn } from "@/lib/utils";
import { type ActionCard as Card, type Verb } from "@/lib/types";
import { toast } from "sonner";
import { useTransition } from "react";
import { pinCardToToday, unpinCard } from "@/lib/server-actions/pin";

const VERB_LABEL: Record<Verb, string> = {
  send: "Send",
  edit_send: "Edit & Send",
  draft: "Draft",
  snooze: "Snooze",
  add_todo: "Add to-do",
  schedule: "Schedule",
  prioritize: "Prioritize",
  log_to_hubspot: "Log to HubSpot",
  mark_won: "Mark won",
  mark_lost: "Mark lost",
  forward_to: "Forward",
  add_to_memory: "Save to memory",
  generate_doc: "Generate doc",
  open_in_cursor: "Open in Cursor",
  dismiss: "Dismiss",
  tell_claude: "Tell Claude",
  message: "Message",
  reconnect: "Reconnect",
};

const PRIMARY_VERBS: Verb[] = [
  "send",
  "edit_send",
  "open_in_cursor",
  "schedule",
  "generate_doc",
  "draft",
];

export function ActionCardItem({
  card,
  compact = false,
  whyNowOverride,
  rank,
}: {
  card: Card;
  compact?: boolean;
  whyNowOverride?: string;
  rank?: number;
}) {
  const [pinPending, startPinTransition] = useTransition();
  const primary = card.verbs.find((v) => PRIMARY_VERBS.includes(v));
  const secondary = card.verbs.filter((v) => v !== primary && v !== "tell_claude");
  const why = whyNowOverride ?? card.why_now;

  const isPinnedToday =
    card.pinned_at != null &&
    new Date(card.pinned_at).toDateString() === new Date().toDateString();

  const handleTogglePin = () => {
    startPinTransition(async () => {
      const result = isPinnedToday
        ? await unpinCard(card.id)
        : await pinCardToToday(card.id);
      if (result.ok) {
        toast.success(isPinnedToday ? "Unpinned" : "Pinned to today");
      } else {
        toast.error(result.error);
      }
    });
  };

  const fire = (verb: Verb) =>
    verb === "tell_claude"
      ? window.dispatchEvent(
          new CustomEvent("jasonos:open-tell-claude", {
            detail: {
              context: {
                scope: "card",
                payload: {
                  id: card.id,
                  track: card.track,
                  module: card.module,
                  title: card.title,
                  subtitle: card.subtitle,
                  why_now: why,
                  body: card.body,
                },
              },
              instruction: `Help me with this card: ${card.title}`,
            },
          })
        )
      : toast.success(`${VERB_LABEL[verb]} → ${card.title}`, {
          description: "Stub action — wire to integration in v1 module work.",
        });

  return (
    <article
      className={cn(
        "jos-card-enter group rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20",
        compact ? "space-y-2" : "space-y-3"
      )}
    >
      <header className="flex items-start gap-2">
        {typeof rank === "number" ? (
          <div className="num-mono mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-semibold text-muted-foreground">
            {rank}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TrackPill track={card.track} />
            {card.vip ? (
              <Badge
                variant="outline"
                className="gap-1 border-[var(--jos-line)] bg-rung-2 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider "
              >
                <Star className="h-2.5 w-2.5 fill-[var(--jos-line)] text-rung-ink" />
                VIP
              </Badge>
            ) : null}
            <span className="text-[10px] text-muted-foreground">{card.module.replaceAll("_", " ")}</span>
          </div>
          <h3 className="mt-1 truncate text-sm font-medium text-foreground">{card.title}</h3>
          {card.subtitle ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{card.subtitle}</p>
          ) : null}
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={handleTogglePin}
          disabled={pinPending}
          aria-label={isPinnedToday ? "Unpin from today" : "Pin to today"}
          className={isPinnedToday ? "text-rung-ink hover:text-rung-ink" : "text-muted-foreground"}
        >
          {isPinnedToday ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </Button>
      </header>

      {why ? (
        <div className="flex items-start gap-1.5 rounded-md border border-[var(--jos-line)] bg-rung-2 px-2 py-1.5 text-[11px] ">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-rung-ink" />
          <span className="leading-snug">{why}</span>
        </div>
      ) : null}

      {!compact && card.body?.draft ? (
        <p className="line-clamp-3 rounded-md bg-muted/60 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {card.body.draft}
        </p>
      ) : null}

      {card.body?.links?.length ? (
        <div className="flex flex-wrap gap-2">
          {card.body.links.map((link) =>
            link.href.startsWith("/") || link.href.startsWith("mailto:") ? (
              <a key={link.href} href={link.href} className="text-[11px] underline">
                {link.label}
              </a>
            ) : (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] underline"
              >
                {link.label}
              </a>
            )
          )}
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center gap-1.5">
        {primary ? (
          <Button size="sm" className="h-7 gap-1.5 px-2.5 text-[11px]" onClick={() => fire(primary)}>
            {VERB_LABEL[primary]}
          </Button>
        ) : null}
        {secondary.slice(0, compact ? 2 : 4).map((v) => (
          <Button
            key={v}
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => fire(v)}
          >
            {VERB_LABEL[v]}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => fire("tell_claude")}
        >
          <Sparkles className="h-3 w-3 text-rung-ink" />
          Tell Claude
        </Button>
      </footer>
    </article>
  );
}
