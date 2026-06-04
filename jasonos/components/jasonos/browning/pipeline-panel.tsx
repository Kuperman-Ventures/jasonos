"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ScoreConversationDialog } from "@/components/jasonos/browning/score-conversation-dialog";
import { AddToBrowningDialog } from "@/components/jasonos/browning/add-to-browning-dialog";
import { ReactivationDraftDialog } from "@/components/jasonos/browning/reactivation-draft-dialog";
import {
  BROWNING_SOURCE_LABELS,
  type BrowningContactRow,
  type BrowningSource,
} from "@/lib/browning/types";
import { fmtRelative, warmthBgClass } from "@/lib/browning/format";

interface Props {
  contacts: BrowningContactRow[];
}

const STALL_DAYS = 30;
const STALL_MS = STALL_DAYS * 24 * 60 * 60 * 1000;

export function PipelinePanel({ contacts }: Props) {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | BrowningSource>(
    "all"
  );
  const [tierFilter, setTierFilter] = useState<"all" | "1" | "2" | "3" | "4">(
    "all"
  );
  const [stalledOnly, setStalledOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<BrowningContactRow | null>(null);
  const [draftRow, setDraftRow] = useState<BrowningContactRow | null>(null);
  // Compute "now" once on mount so the stalled filter is stable across
  // renders and Date.now() doesn't run during render (purity rule).
  const [nowMs, setNowMs] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setNowMs(Date.now());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (sourceFilter !== "all" && c.browning_source !== sourceFilter)
        return false;
      if (tierFilter !== "all") {
        const t = Number(tierFilter);
        if (c.browning_tier !== t) return false;
      }
      if (stalledOnly) {
        if (!c.last_touch_at) return true;
        if (!nowMs) return true; // before first paint, treat as stalled to avoid hiding
        if (nowMs - new Date(c.last_touch_at).getTime() < STALL_MS) return false;
      }
      if (q) {
        const hay = [c.name, c.title ?? "", c.company ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, query, sourceFilter, tierFilter, stalledOnly, nowMs]);

  const draftCount = useMemo(
    () => contacts.filter((contact) => contact.has_draft).length,
    [contacts]
  );

  return (
    <div className="space-y-3">
      {draftCount > 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-amber-200/90">
            {draftCount} {draftCount === 1 ? "contact has" : "contacts have"} a
            draft ready.
          </span>{" "}
          Click <span className="font-medium">Draft</span> on a row to open and
          send.
        </div>
      ) : null}

      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
              placeholder="Name, title, company…"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Source
          </label>
          <Select
            value={sourceFilter}
            onValueChange={(v) =>
              setSourceFilter(v as "all" | BrowningSource)
            }
          >
            <SelectTrigger size="sm" className="min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="my_list">My List</SelectItem>
              <SelectItem value="browning_referral">Browning Referral</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tier
          </label>
          <Select
            value={tierFilter}
            onValueChange={(v) =>
              setTierFilter(v as "all" | "1" | "2" | "3" | "4")
            }
          >
            <SelectTrigger size="sm" className="min-w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
              <SelectItem value="4">Tier 4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-xs">
          <Checkbox
            checked={stalledOnly}
            onCheckedChange={(v) => setStalledOnly(Boolean(v))}
          />
          <span>Stalled (no touch &gt;30d)</span>
        </label>
        <div className="ml-auto">
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus className="h-3.5 w-3.5" />
            Add to Browning
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-card/40">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Title / Company</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-left">Last touch</th>
              <th className="px-3 py-2 text-right">Convs</th>
              <th className="px-3 py-2 text-right">Avg Warmth</th>
              <th className="px-3 py-2 text-right">Avg Quality</th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No Browning contacts match these filters. Use{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => setAddOpen(true)}
                  >
                    Add to Browning
                  </button>{" "}
                  to tag a contact.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.contact_id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/outreach/people?id=${c.contact_id}`}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[c.title, c.company].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        c.browning_source === "browning_referral"
                          ? "border-amber-500/40 text-amber-200"
                          : "border-sky-500/40 text-sky-200"
                      )}
                    >
                      {BROWNING_SOURCE_LABELS[c.browning_source]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {c.browning_tier ? (
                      <Badge variant="secondary">T{c.browning_tier}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.last_touch_at ? fmtRelative(c.last_touch_at) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.conversations_count}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <WarmthChip value={c.avg_warmth} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <WarmthChip value={c.avg_quality_overall} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        title={
                          c.has_draft
                            ? "Open reactivation draft + log send"
                            : "No draft on file"
                        }
                        disabled={!c.has_draft}
                        onClick={() => setDraftRow(c)}
                      >
                        <FileText className="h-3 w-3" />
                        Draft
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        title="Score the most recent conversation"
                        onClick={() => setActiveRow(c)}
                      >
                        <Sparkles className="h-3 w-3" />
                        Score
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-muted-foreground">
        Showing {filtered.length} of {contacts.length} Browning contacts •{" "}
        {draftCount} with drafts ready.
      </div>

      <AddToBrowningDialog open={addOpen} onOpenChange={setAddOpen} />

      {activeRow ? (
        <ScoreConversationDialog
          open={!!activeRow}
          onOpenChange={(next) => {
            if (!next) setActiveRow(null);
          }}
          contactId={activeRow.contact_id}
          contactName={activeRow.name}
        />
      ) : null}

      {draftRow ? (
        <ReactivationDraftDialog
          open={!!draftRow}
          onOpenChange={(next) => {
            if (!next) setDraftRow(null);
          }}
          contactId={draftRow.contact_id}
          contactName={draftRow.name}
        />
      ) : null}
    </div>
  );
}

function WarmthChip({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        warmthBgClass(value)
      )}
    >
      {value.toFixed(1)}
    </span>
  );
}

