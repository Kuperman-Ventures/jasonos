"use client";

// UnscoredConversationsDialog — backstop for the inline scoring auto-prompt.
// Lists every touch >24h old on a Browning-tagged contact that has no
// matching browning_conversations.linked_touch_id row. Clicking "Score now"
// opens the ScoreConversationDialog pre-filled with that touch's metadata.

import { useEffect, useState } from "react";
import { Loader2, Mail, Link2, Phone, Video, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchUnscoredTouches } from "@/lib/server-actions/browning";
import type { UnscoredTouch } from "@/lib/browning/types";
import { ScoreConversationDialog } from "@/components/jasonos/browning/score-conversation-dialog";
import { fmtRelative, toBrowningChannel } from "@/lib/browning/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const channelIcon = (raw: string) => {
  const c = raw.toLowerCase();
  if (c === "email") return <Mail className="h-3.5 w-3.5" />;
  if (c === "linkedin") return <Link2 className="h-3.5 w-3.5" />;
  if (c === "phone" || c === "call") return <Phone className="h-3.5 w-3.5" />;
  if (c === "meeting" || c === "zoom" || c === "video")
    return <Video className="h-3.5 w-3.5" />;
  return <MessageSquare className="h-3.5 w-3.5" />;
};

export function UnscoredConversationsDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UnscoredTouch[]>([]);
  const [active, setActive] = useState<UnscoredTouch | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const r = await fetchUnscoredTouches();
        if (!cancelled) setRows(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleScored = () => {
    // Drop the row from the local list so the modal stays in sync without a
    // round-trip; revalidatePath('/') in the action covers the home card.
    if (active) {
      setRows((prev) => prev.filter((r) => r.touch_id !== active.touch_id));
    }
    setActive(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Unscored conversations</DialogTitle>
            <DialogDescription>
              Touches with Browning contacts more than 24 hours old that you
              haven&rsquo;t scored yet. Score them now while the conversation
              is fresh.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              All caught up. Nothing to score.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {rows.map((r) => (
                <li
                  key={r.touch_id}
                  className="flex items-center gap-3 p-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {channelIcon(r.channel)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.contact_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {fmtRelative(r.touched_at)} · {r.channel}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setActive(r)}>
                    Score now
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {active ? (
        <ScoreConversationDialog
          open={!!active}
          onOpenChange={(next) => {
            if (!next) handleScored();
          }}
          contactId={active.contact_id}
          contactName={active.contact_name}
          linkedTouchId={active.touch_id}
          defaultDate={active.touched_at.slice(0, 10)}
          defaultChannel={toBrowningChannel(active.channel)}
        />
      ) : null}
    </>
  );
}
