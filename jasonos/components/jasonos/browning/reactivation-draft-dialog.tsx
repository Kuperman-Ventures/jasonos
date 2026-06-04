"use client";

// ReactivationDraftDialog — opens from the Browning Pipeline panel's per-row
// Draft button. Surfaces the most recent reconnect cadence card for the
// contact (subtitle, hook, recommended approach, prior comms summary,
// editable draft body) and lets Kupe copy the message and/or log a
// LinkedIn touch right from this dialog. The draft textarea is editable
// so last-second tweaks ride along to the clipboard. Once "Mark Sent" is
// confirmed we insert one contact_touches row, stamp the contact's
// last_touch_*, action the card, revalidate /browning + /, and close.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getReactivationDraftForContact,
  markBrowningTouchSent,
  type ReactivationDraft,
} from "@/lib/server-actions/browning";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
}

const EM_DASH = "—";

function deriveBrief(message: string): string {
  const collapsed = message.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 80) return collapsed;
  return collapsed.slice(0, 80).trimEnd();
}

export function ReactivationDraftDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [draft, setDraft] = useState<ReactivationDraft | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Inline confirm panel (shown when user clicks "Mark Sent" — kept in the
  // same dialog, not a second one, per the spec).
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [threadUrl, setThreadUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      // Defer the synchronous resets one microtask to satisfy the
      // react-hooks/set-state-in-effect rule (matches the pattern used by
      // the rest of the Browning dialogs).
      await Promise.resolve();
      if (cancelled) return;
      setLoadError(null);
      setConfirmOpen(false);
      setBrief("");
      setThreadUrl("");
      setDraft(null);
      setMessage("");
      setLoading(true);

      try {
        const row = await getReactivationDraftForContact(contactId);
        if (cancelled) return;
        if (!row) {
          setLoadError(`No draft on file for ${contactName}.`);
          return;
        }
        setDraft(row);
        setMessage(row.draft_message ?? "");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load draft.";
        setLoadError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, contactId, contactName]);

  const briefAuto = useMemo(() => deriveBrief(message), [message]);
  const briefValue = brief || briefAuto;

  const copyMessage = async () => {
    const text = message.trim();
    if (!text) {
      toast.error("Draft message is empty.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const openConfirm = () => {
    setBrief("");
    setThreadUrl("");
    setConfirmOpen(true);
  };

  const submitMarkSent = () => {
    startTransition(async () => {
      const result = await markBrowningTouchSent({
        contactId,
        cardId: draft?.card_id ?? null,
        brief: briefValue || null,
        threadUrl: threadUrl.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error || "Could not mark sent.");
        return;
      }
      toast.success(`Logged. ${contactName} marked sent.`);
      onOpenChange(false);
      router.refresh();
    });
  };

  const showLinkedInChip = Boolean(draft?.linkedin_url);
  const channelLabel =
    draft?.channel === "linkedin"
      ? "LinkedIn DM"
      : draft?.channel
        ? draft.channel.replace(/_/g, " ")
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>Reactivation draft — {contactName}</DialogTitle>
          {draft?.subtitle ? (
            <DialogDescription className="text-xs text-muted-foreground">
              {draft.subtitle}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading draft…
            </div>
          ) : null}

          {loadError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {loadError}
            </div>
          ) : null}

          {!loading && !loadError && draft ? (
            <>
              {/* Hook + channel chip */}
              <div className="flex flex-wrap items-center gap-2">
                {draft.hook ? (
                  <Badge variant="secondary" className="text-[11px] font-normal">
                    Why now: {draft.hook}
                  </Badge>
                ) : null}
                {channelLabel ? (
                  showLinkedInChip ? (
                    <a
                      href={draft.linkedin_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      {channelLabel}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                      {channelLabel}
                    </span>
                  )
                ) : null}
              </div>

              {/* Recommended approach */}
              {draft.strategic_recommended_approach ? (
                <p className="text-xs italic text-muted-foreground">
                  {draft.strategic_recommended_approach}
                </p>
              ) : null}

              {/* Prior comms summary */}
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Summary of prior comms
                </div>
                <div className="rounded-md border bg-card/40 px-3 py-2 text-xs text-foreground">
                  {draft.summary_of_prior_comms ?? EM_DASH}
                </div>
              </div>

              {/* Draft message — editable */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Draft message
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    Editable — your edits ride along to the clipboard.
                  </span>
                </div>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={10}
                  className="font-mono text-[13px] leading-relaxed"
                  placeholder="Draft message body…"
                />
              </div>

              {/* Inline Mark Sent confirm panel */}
              {confirmOpen ? (
                <div className="space-y-3 rounded-lg border bg-card/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium">Confirm sent</div>
                    <span className="text-[10px] text-muted-foreground">
                      Channel: LinkedIn · Direction: outbound
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Brief
                      </label>
                      <Input
                        value={brief}
                        onChange={(event) => setBrief(event.target.value)}
                        className="h-8 text-xs"
                        placeholder={briefAuto || "Short summary of what you sent"}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Thread URL (optional)
                      </label>
                      <Input
                        value={threadUrl}
                        onChange={(event) => setThreadUrl(event.target.value)}
                        className="h-8 text-xs"
                        placeholder="https://www.linkedin.com/messaging/thread/…"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmOpen(false)}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={submitMarkSent}
                      disabled={pending}
                    >
                      {pending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Confirm sent
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyMessage()}
            disabled={!message.trim() || pending || Boolean(loadError) || loading}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy message
          </Button>
          <Button
            type="button"
            onClick={openConfirm}
            disabled={
              pending ||
              loading ||
              Boolean(loadError) ||
              !draft ||
              confirmOpen
            }
          >
            <Send className="h-3.5 w-3.5" />
            Mark Sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
