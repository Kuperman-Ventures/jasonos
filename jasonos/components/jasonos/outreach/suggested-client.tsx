"use client";

// Suggested Contacts — people seen in email or calendar whose exact email
// isn't in People yet. Name matches offer Merge (attach this address to the
// existing row) or Add as new. Dismiss is a permanent ignore.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Building2,
  GitMerge,
  Mail,
  RefreshCw,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import {
  addCandidateAsContact,
  dismissCandidate,
  type ContactCandidate,
} from "@/lib/server-actions/contact-candidates";
import {
  beeperScanLine,
  type SuggestedScanResult,
} from "@/lib/outreach/suggested-scan";

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
  // After Add, open the contact card so intent / cadence / etc. can be set now.
  const [setup, setSetup] = useState<{
    contactId: string;
    name: string;
    firm: string | null;
  } | null>(null);

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
      try {
        const res = await fetch("/api/outreach/scan-suggested", {
          method: "POST",
          cache: "no-store",
        });
        const result = (await res.json()) as SuggestedScanResult;
        if (!res.ok || !result.ok) {
          toast.error(
            !result.ok ? result.error : `Scan failed (${res.status})`
          );
          return;
        }
        const beeperLine = beeperScanLine(result.beeper);
        toast.success(
          `Scanned ${result.scanned} messages · ${result.created} new, ${result.updated} updated`,
          {
            description: [
              "Last 90 days of email, calendar, and Beeper.",
              beeperLine,
              `${result.skipped} robots skipped.`,
            ]
              .filter(Boolean)
              .join(" "),
          }
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Scan failed. Try again."
        );
      }
    });
  };

  const matches = useMemo(
    () => visible.filter((c) => c.nameMatch),
    [visible]
  );
  const fresh = useMemo(
    () => visible.filter((c) => !c.nameMatch),
    [visible]
  );

  const onAdd = async (
    c: ContactCandidate,
    opts?: { mergeIntoContactId?: string }
  ) => {
    setActioned((prev) => new Set(prev).add(c.id));
    const result = await addCandidateAsContact(c.id, opts);
    if (!result.ok) {
      setActioned((prev) => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
      toast.error(result.error);
      return;
    }
    const displayName = c.nameMatch?.name || c.name || c.email;
    toast.success(
      opts?.mergeIntoContactId
        ? `Merged ${c.email} onto ${displayName}`
        : `Added ${displayName} — set them up`
    );
    setSetup({
      contactId: result.contactId,
      name: displayName,
      firm: c.company,
    });
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
            People from email, calendar invites, and Beeper chats who aren&rsquo;t
            already in People by email. If the name is already in the system,
            merge to attach this address. Otherwise add or dismiss. Dismissed
            people don&rsquo;t come back.
          </p>
        </div>
        <Button
          onClick={handleScan}
          disabled={scanning || !gmailConnected}
          title="Same as Sync: last 90 days of email, calendar, and Beeper (when Desktop is open)"
        >
          <RefreshCw className={cn("h-4 w-4", scanning && "animate-spin")} />
          {scanning ? "Scanning…" : "Scan"}
        </Button>
      </header>

      {!gmailConnected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="text-xs text-amber-200">
            Gmail isn&rsquo;t connected — connect it to scan for suggested
            contacts.
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href="/api/auth/google"
              className="rounded-md border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-500/30"
            >
              Connect Advisors Google →
            </a>
            <a
              href="/api/auth/google?account=gmail"
              className="rounded-md border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-500/30"
            >
              Connect personal Gmail →
            </a>
          </div>
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
              ? "No suggested contacts. Hit “Scan” to look for new people."
              : "Connect Gmail, then scan to see suggestions."}
          </div>
        ) : (
          <ul className="divide-y">
            {matches.length ? (
              <li className="bg-muted/40 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Name already in People — merge or add as new
              </li>
            ) : null}
            {matches.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                onAdd={() => onAdd(c)}
                onMerge={() =>
                  onAdd(c, { mergeIntoContactId: c.nameMatch!.id })
                }
                onDismiss={() => onDismiss(c)}
              />
            ))}
            {matches.length && fresh.length ? (
              <li className="bg-muted/40 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                New people
              </li>
            ) : null}
            {fresh.map((c) => (
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

      <OutreachModal
        open={!!setup}
        onOpenChange={(o) => {
          if (!o) setSetup(null);
        }}
        contactId={setup?.contactId}
        initialDisplay={
          setup
            ? { name: setup.name, title: null, firm: setup.firm }
            : undefined
        }
      />
    </div>
  );
}

function CandidateRow({
  candidate,
  onAdd,
  onMerge,
  onDismiss,
}: {
  candidate: ContactCandidate;
  onAdd: () => void;
  onMerge?: () => void;
  onDismiss: () => void;
}) {
  const [pending, setPending] = useState(false);
  const twoWay = candidate.inbound_count > 0 && candidate.outbound_count > 0;
  const match = candidate.nameMatch;

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
        {match ? (
          <div className="mt-1 text-[11px] text-sky-200/90">
            {match.kind === "close"
              ? `Looks like ${match.name} in People`
              : `Already in People as ${match.name}`}
            {" — "}
            merge to attach this email, or add as a new person.
          </div>
        ) : null}
        {candidate.last_subject ? (
          <div className="mt-0.5 truncate text-[11px] italic text-muted-foreground/70">
            “{candidate.last_subject}”
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {onMerge ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(onMerge)}
          >
            <GitMerge className="h-3.5 w-3.5" />
            Merge
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(onAdd)}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {onMerge ? "Add as new" : "Add"}
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
