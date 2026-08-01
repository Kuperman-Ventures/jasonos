"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  searchContactsForBrowning,
  setContactBrowning,
  type BrowningContactSearchResult,
} from "@/lib/server-actions/browning";
import {
  BROWNING_SOURCE_LABELS,
  type BrowningSource,
  type BrowningTier,
} from "@/lib/browning/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToBrowningDialog({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BrowningContactSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<BrowningContactSearchResult | null>(
    null
  );
  const [source, setSource] = useState<BrowningSource>("my_list");
  const [tier, setTier] = useState<BrowningTier>(2);
  const [pending, startTransition] = useTransition();

  // Reset on open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setQuery("");
      setResults([]);
      setSelected(null);
      setSource("my_list");
      setTier(2);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        await Promise.resolve();
        if (cancelled) return;
        setSearching(true);
        searchContactsForBrowning(query, 20)
          .then((r) => {
            if (!cancelled) setResults(r);
          })
          .finally(() => {
            if (!cancelled) setSearching(false);
          });
      })();
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, query]);

  const filteredResults = useMemo(() => results, [results]);

  const handleAdd = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await setContactBrowning({
        contactId: selected.id,
        source,
        tier,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Added ${selected.name} to Browning.`);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add contact to Browning</DialogTitle>
          <DialogDescription>
            Tag an existing contact as part of the Browning warm-market loop.
            Pick the source (My List vs. Browning Referral) and the tier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Find contact
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
                placeholder="Type a name…"
              />
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-md border bg-card/40">
              {searching && filteredResults.length === 0 ? (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Searching…
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  No contacts match. Use Add contact on Outreach → Queue to
                  create a new contact, then return here to tag them.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredResults.map((r) => {
                    const active = selected?.id === r.id;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(r)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                            active
                              ? "bg-foreground/10"
                              : "hover:bg-muted/40"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {r.name}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {[r.title, r.company]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </div>
                          </div>
                          {r.browning_source ? (
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
                              In Browning
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Source
              </label>
              <Select
                value={source}
                onValueChange={(v) => setSource(v as BrowningSource)}
              >
                <SelectTrigger size="default" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my_list">
                    {BROWNING_SOURCE_LABELS.my_list}
                  </SelectItem>
                  <SelectItem value="browning_referral">
                    {BROWNING_SOURCE_LABELS.browning_referral}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tier (1–4)
              </label>
              <Select
                value={String(tier)}
                onValueChange={(v) => setTier(Number(v) as BrowningTier)}
              >
                <SelectTrigger size="default" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      Tier {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!selected || pending}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
