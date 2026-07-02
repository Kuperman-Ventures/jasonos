"use client";

// Suggested Contacts — a review inbox of people seen in email (sent/received)
// who aren't in the People list yet. Add (creates an unclassified contact that
// flows into "Needs to be Classified & Scheduled") or Dismiss (permanent
// ignore). Fed by captureEmailCandidates (Gmail scan) with noise filtering.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Building2,
  Mail,
  RefreshCw,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addCandidateAsContact,
  captureEmailCandidates,
  dismissCandidate,
  type ContactCandidate,
} from "@/lib/server-actions/contact-candidates";

export function SuggestedClient({
  candidates,
  gmailConnected,
}: {
  candidates: ContactCandidate[];
  gmailConnected: boolean;
}) {
  const router = useRouter();
  const [scanning, startScan] = useTransition();
  const [twoWayOnly, setTwoWayOnly] = useState(false);
  // Optimistically hide rows the user has actioned.
  const [actioned, setActioned] = useState<Set<string>>(() => new Set());

  const visible = useMemo(
    () =>
      candidates.filter((c) => {
        if (actioned.has(c.id)) return false;
        if (twoWayOnly && !(c.inbound_count > 0 && c.outbound_count > 0))
          return false;
        return true;
      }),
    [candidates, actioned, twoWayOnly]
  );

  const twoWayCount = useMemo(
    () =>
      candidates.filter(
        (c) => !actioned.has(c.id) && c.inbound_count > 0 && c.outbound_count > 0
      ).length,
    [candidates, actioned]
  );

  const handleScan = () => {
    startScan(async () => {
      const result = await captureEmailCandidates({ days: 30 });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Scanned ${result.scanned} messages · ${result.created} new, ${result.updated} updated`,
        { description: `${result.skipped} automated/bulk senders skipped.` }
      );
      router.refresh();
    });
  };

  const onAdd = async (c: ContactCandidate) => {
    setActioned((prev) => new Set(prev).add(c.id));
    const result = await addCandidateAsContact(c.id);
    if (!result.ok) {
      setActioned((prev) => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
      toast.error(result.error);
      return;
    }
    toast.success(`Added ${c.name || c.email} to People`);
    router.refresh();
  };

  const onDismiss = async (c: ContactCandidate) => {
    setActioned((prev) => new Set(prev).add(c.id));
    const result = await dismissCandidate(c.id);
    if (!result.ok) {
      setActioned((prev) => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
      toast.error(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Suggested contacts
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            People you&rsquo;ve emailed or who&rsquo;ve emailed you that aren&rsquo;t
            in your People list yet. Add the ones worth tracking; dismiss the
            rest (they won&rsquo;t come back). Automated and bulk senders are
            filtered out automatically.
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanning || !gmailConnected}>
          <RefreshCw className={cn("h-4 w-4", scanning && "animate-spin")} />
          {scanning ? "Scanning…" : "Scan email"}
        </Button>
      </header>

      {!gmailConnected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="text-xs text-amber-200">
            Gmail isn&rsquo;t connected — connect it to scan for suggested
            contacts.
          </div>
          <a
            href="/api/auth/google"
            className="shrink-0 rounded-md border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-500/30"
          >
            Connect Gmail →
          </a>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTwoWayOnly((v) => !v)}
          aria-pressed={twoWayOnly}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
            twoWayOnly
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Two-way only
          <span
            className={cn(
              "font-mono text-[10px]",
              twoWayOnly ? "text-background/70" : "text-muted-foreground/70"
            )}
          >
            {twoWayCount}
          </span>
        </button>
        <span className="text-xs text-muted-foreground">
          {visible.length} suggested
        </span>
      </div>

      <div className="rounded-lg border bg-card">
        {visible.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {gmailConnected
              ? "No suggested contacts. Hit “Scan email” to look for new people."
              : "Connect Gmail, then scan to see suggestions."}
          </div>
        ) : (
          <ul className="divide-y">
            {visible.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                onAdd={() => onAdd(c)}
                onDismiss={() => onDismiss(c)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  onAdd,
  onDismiss,
}: {
  candidate: ContactCandidate;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  const [pending, setPending] = useState(false);
  const twoWay = candidate.inbound_count > 0 && candidate.outbound_count > 0;

  const run = (fn: () => void) => {
    setPending(true);
    fn();
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">
            {candidate.name || candidate.email}
          </span>
          {twoWay ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-300">
              <ArrowLeftRight className="h-2.5 w-2.5" />
              Two-way
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {candidate.email}
          </span>
          {candidate.company ? (
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {candidate.company}
            </span>
          ) : null}
          <span>
            {candidate.outbound_count} sent · {candidate.inbound_count} received
          </span>
        </div>
        {candidate.last_subject ? (
          <div className="mt-0.5 truncate text-[11px] italic text-muted-foreground/70">
            “{candidate.last_subject}”
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(onAdd)}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          title="Dismiss — don't suggest again"
          disabled={pending}
          onClick={() => run(onDismiss)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
