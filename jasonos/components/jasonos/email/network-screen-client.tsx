"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ContactPicker } from "@/components/jasonos/email/contact-picker";
import { buildMailtoUrl } from "@/lib/email-templates/render";
import { buildCapturePrompt } from "@/lib/network-screen/capture-prompt";
import {
  BUCKETS,
  BUCKET_LABELS,
  QUEUE_STATUSES,
  QUEUE_STATUS_LABELS,
  SCREEN_STATUS_LABELS,
  TIER_LABELS,
  TIERS,
  WARMTHS,
  WARMTH_LABELS,
  type Bucket,
  type NetworkScreenCandidate,
  type NetworkScreenDetail,
  type NetworkScreenListItem,
  type QueueStatus,
  type RelationshipWarmth,
  type Tier,
} from "@/lib/network-screen/types";
import {
  createNetworkScreen,
  draftIntroRequest,
  getNetworkScreen,
  listNetworkScreens,
  markIntrosRequested,
  scoreNetworkScreen,
  updateCandidate,
  updateNetworkScreen,
  type CandidatePatch,
} from "@/lib/server-actions/network-screen";

const selectClass =
  "h-8 max-w-full rounded-lg border border-input bg-transparent px-2 text-sm";

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

function stepFor(screen: NetworkScreenDetail | null): 1 | 2 | 3 {
  if (!screen) return 1;
  if (screen.status === "awaiting_capture") return 2;
  return 3;
}

export function NetworkScreenClient({ initialScreenId }: { initialScreenId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState<NetworkScreenListItem[]>([]);
  const [screen, setScreen] = useState<NetworkScreenDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [commitments, setCommitments] = useState("");
  const [partner, setPartner] = useState("");
  const [warmth, setWarmth] = useState<RelationshipWarmth>("new");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [seenScreen, setSeenScreen] = useState("");
  const [picked, setPicked] = useState<string[] | null>(null);
  const [pickedFor, setPickedFor] = useState<string | null>(null);
  const [bucketFilter, setBucketFilter] = useState("all");
  const [othersOpen, setOthersOpen] = useState(false);

  if (screen) {
    const key = `${screen.id}:${screen.updatedAt}`;
    if (seenScreen !== key) {
      setSeenScreen(key);
      setNotes(screen.meetingNotesSummary ?? "");
      setCommitments(screen.openCommitments ?? "");
      setPartner(screen.partnerNote ?? "");
      setWarmth(screen.relationshipWarmth);
      setDraftSubject(screen.draftSubject ?? "");
      setDraftBody(screen.draftBody ?? "");
    }
    if (pickedFor !== screen.id) {
      setPickedFor(screen.id);
      setPicked(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void listNetworkScreens().then((result) => {
      if (!cancelled && result.ok) setList(result.screens);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialScreenId) return;
    let cancelled = false;
    void getNetworkScreen(initialScreenId).then((result) => {
      if (!cancelled && result.ok) setScreen(result.screen);
    });
    return () => {
      cancelled = true;
    };
  }, [initialScreenId]);

  const screenId = screen?.id ?? null;
  const screenStatus = screen?.status ?? null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("section", "network-screen");
    if (screenId) params.set("screen", screenId);
    else if (!initialScreenId) params.delete("screen");
    const next = `/email-templates?${params.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      router.replace(next, { scroll: false });
    }
  }, [initialScreenId, router, screenId]);

  useEffect(() => {
    if (!screenId || screenStatus !== "awaiting_capture") return;
    const timer = setInterval(() => {
      void getNetworkScreen(screenId).then((result) => {
        if (!result.ok) return;
        setScreen(result.screen);
        if (result.screen.status === "captured") {
          toast.success(`${result.screen.visibleCount} connections imported`);
        }
      });
    }, 10000);
    return () => clearInterval(timer);
  }, [screenId, screenStatus]);

  function refreshList() {
    void listNetworkScreens().then((result) => {
      if (result.ok) setList(result.screens);
    });
  }

  function saveScreen(patch: Parameters<typeof updateNetworkScreen>[0]["patch"]) {
    if (!screen) return;
    startTransition(async () => {
      const result = await updateNetworkScreen({ screenId: screen.id, patch });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setScreen(result.screen);
    });
  }

  function saveCandidate(id: string, patch: CandidatePatch) {
    startTransition(async () => {
      const result = await updateCandidate({ id, patch });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (patch.tier === "tier1" && result.candidate.tier === "tier2") {
        toast("1st-degree connections stay Tier 2.");
      }
      setScreen((current) =>
        current
          ? {
              ...current,
              candidates: current.candidates.map((person) =>
                person.id === id ? result.candidate : person
              ),
            }
          : current
      );
    });
  }

  const step = creating || !screen ? 1 : stepFor(screen);
  const tier1 = screen?.candidates.filter((person) => person.tier === "tier1") ?? [];
  const tier2 = screen?.candidates.filter((person) => person.tier === "tier2") ?? [];
  const others =
    screen?.candidates.filter((person) => person.tier !== "tier1" && person.tier !== "tier2") ?? [];
  const checked = new Set(picked ?? tier1.map((person) => person.id));

  if (!screen && !creating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Network screens</h2>
          <Button type="button" onClick={() => setCreating(true)}>
            New screen
          </Button>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No screens yet. Start with someone whose network you want to read.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {list.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-baseline justify-between gap-2 px-3 py-3 text-left hover:bg-muted/60"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await getNetworkScreen(item.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setScreen(result.screen);
                    });
                  }}
                >
                  <span className="font-medium">{item.connectorName}</span>
                  <span className="text-sm text-muted-foreground">
                    {SCREEN_STATUS_LABELS[item.status]} · {item.tier1Count} Tier 1 · {item.queuedCount} queued · {formatWhen(item.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={() => {
            setScreen(null);
            setCreating(false);
            setFormError(null);
            refreshList();
          }}
        >
          All screens
        </button>
        {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {(
          [
            [1, "Pick connector"],
            [2, "Capture in Claude"],
            [3, "Review"],
          ] as const
        ).map(([number, label]) => {
          const done =
            !!screen &&
            (number === 1 ||
              (number === 2 && screen.status !== "awaiting_capture") ||
              (number === 3 && screen.status === "requested"));
          const active = step === number;
          return (
            <li
              key={number}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                active ? "border-foreground font-semibold" : "text-muted-foreground"
              )}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs">
                {done ? <Check className="h-3.5 w-3.5" /> : number}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <div className="space-y-3">
          <ContactPicker
            onSelect={(contact) => {
              setFormError(null);
              startTransition(async () => {
                const result = await createNetworkScreen({ contactId: contact.id });
                if (!result.ok) {
                  setFormError(result.error);
                  return;
                }
                setScreen(result.screen);
                setCreating(false);
                refreshList();
              });
            }}
          />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </div>
      ) : null}

      {screen ? (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <div>
            <h2 className="text-xl font-semibold">{screen.connectorName}</h2>
            <p className="text-sm text-muted-foreground">
              {[screen.connectorHeadline, screen.connectorCompany, screen.connectorDegree]
                .filter(Boolean)
                .join(" · ") || screen.connectorLinkedinUrl}
            </p>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Warmth</span>
            <select
              className={selectClass}
              value={warmth}
              onChange={(event) => {
                const value = event.target.value as RelationshipWarmth;
                setWarmth(value);
                saveScreen({ relationshipWarmth: value });
              }}
            >
              {WARMTHS.map((value) => (
                <option key={value} value={value}>
                  {WARMTH_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Meeting notes</span>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => {
                if (notes === (screen.meetingNotesSummary ?? "")) return;
                saveScreen({ meetingNotesSummary: notes });
              }}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Open commitments</span>
            <Textarea
              value={commitments}
              onChange={(event) => setCommitments(event.target.value)}
              onBlur={() => {
                if (commitments === (screen.openCommitments ?? "")) return;
                saveScreen({ openCommitments: commitments });
              }}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Partner note</span>
            <Textarea
              value={partner}
              onChange={(event) => setPartner(event.target.value)}
              onBlur={() => {
                if (partner === (screen.partnerNote ?? "")) return;
                saveScreen({ partnerNote: partner });
              }}
            />
          </label>
        </section>
      ) : null}

      {screen && step === 2 ? (
        <section className="space-y-3">
          <Button
            type="button"
            onClick={() => {
              const text = buildCapturePrompt({
                screenId: screen.id,
                connectorName: screen.connectorName,
                connectorLinkedinUrl: screen.connectorLinkedinUrl,
              });
              void navigator.clipboard.writeText(text).then(
                () => toast.success("Prompt copied. Paste it into Claude."),
                () => toast.error("Could not copy the prompt.")
              );
            }}
          >
            <ClipboardCopy className="h-4 w-4" />
            Copy capture prompt
          </Button>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Paste the prompt into Claude.</li>
            <li>Claude pages LinkedIn in your Chrome and imports the list.</li>
            <li>This page updates on its own.</li>
          </ol>
        </section>
      ) : null}

      {screen && step === 3 ? (
        <section className="space-y-6">
          {screen.status === "captured" ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await scoreNetworkScreen({ screenId: screen.id });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setScreen(result.screen);
                  toast.success("Scoring finished.");
                });
              }}
            >
              Score {screen.candidates.length} people
            </Button>
          ) : (
            <>
              <p className="text-sm">
                {screen.totalCountLabel
                  ? `${screen.visibleCount} of ${screen.totalCountLabel} connections were visible. ${tier1.length} Tier 1.`
                  : `${screen.visibleCount} connections were visible. ${tier1.length} Tier 1.`}
              </p>

              <div className="space-y-2">
                <h3 className="font-semibold">Tier 1</h3>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 font-medium">Name</th>
                        <th className="px-2 py-2 font-medium">Title</th>
                        <th className="px-2 py-2 font-medium">Company</th>
                        <th className="px-2 py-2 font-medium">Bucket</th>
                        <th className="px-2 py-2 font-medium">Why</th>
                        <th className="px-2 py-2 font-medium">Ask</th>
                        <th className="px-2 py-2 font-medium">Tier</th>
                        <th className="px-2 py-2 font-medium">Queue status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tier1.map((person) => (
                        <tr key={person.id} className="border-b align-top last:border-0">
                          <td className="px-2 py-2 font-medium">{person.name}</td>
                          <td className="px-2 py-2">{person.title}</td>
                          <td className="px-2 py-2">{person.company}</td>
                          <td className="px-2 py-2">
                            <BucketSelect person={person} onChange={saveCandidate} />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              key={`${person.id}-why-${person.why ?? ""}`}
                              defaultValue={person.why ?? ""}
                              onBlur={(event) => {
                                if (event.target.value === (person.why ?? "")) return;
                                saveCandidate(person.id, { why: event.target.value });
                              }}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              key={`${person.id}-ask-${person.ask ?? ""}`}
                              defaultValue={person.ask ?? ""}
                              onBlur={(event) => {
                                if (event.target.value === (person.ask ?? "")) return;
                                saveCandidate(person.id, { ask: event.target.value });
                              }}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <TierSelect person={person} onChange={saveCandidate} />
                          </td>
                          <td className="px-2 py-2">
                            <QueueSelect person={person} onChange={saveCandidate} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {tier1.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">No Tier 1 people.</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Tier 2</h3>
                <ul className="divide-y divide-border rounded-lg border">
                  {tier2.map((person) => (
                    <li key={person.id} className="grid gap-2 px-3 py-2 text-sm md:grid-cols-[1fr_1fr_auto_auto]">
                      <span>
                        <span className="font-medium">{person.name}</span>
                        {person.headline ? <span className="block text-muted-foreground">{person.headline}</span> : null}
                      </span>
                      <span>{BUCKET_LABELS[person.bucket]}</span>
                      <span>{person.nextAction}</span>
                      <TierSelect person={person} onChange={saveCandidate} />
                    </li>
                  ))}
                  {tier2.length === 0 ? (
                    <li className="px-3 py-3 text-sm text-muted-foreground">No Tier 2 people.</li>
                  ) : null}
                </ul>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  className="text-sm font-semibold"
                  onClick={() => setOthersOpen((open) => !open)}
                >
                  Everyone else ({others.length})
                </button>
                {othersOpen ? (
                  <div className="space-y-2">
                    <select
                      className={selectClass}
                      value={bucketFilter}
                      onChange={(event) => setBucketFilter(event.target.value)}
                    >
                      <option value="all">All buckets</option>
                      {BUCKETS.map((bucket) => (
                        <option key={bucket} value={bucket}>
                          {BUCKET_LABELS[bucket]}
                        </option>
                      ))}
                    </select>
                    <ul className="divide-y divide-border rounded-lg border">
                      {others
                        .filter((person) => bucketFilter === "all" || person.bucket === bucketFilter)
                        .map((person) => (
                          <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                            <span>
                              <span className="font-medium">{person.name}</span>
                              <span className="text-muted-foreground"> · {BUCKET_LABELS[person.bucket]}</span>
                            </span>
                            <TierSelect person={person} onChange={saveCandidate} />
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await draftIntroRequest({ screenId: screen.id });
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setScreen(result.screen);
                      setDraftSubject(result.subject);
                      setDraftBody(result.body);
                    });
                  }}
                >
                  Draft intro request
                </Button>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Subject</span>
                  <Input
                    value={draftSubject}
                    onChange={(event) => setDraftSubject(event.target.value)}
                    onBlur={() => {
                      if (draftSubject === (screen.draftSubject ?? "")) return;
                      saveScreen({ draftSubject });
                    }}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Body</span>
                  <Textarea
                    className="min-h-40"
                    value={draftBody}
                    onChange={(event) => setDraftBody(event.target.value)}
                    onBlur={() => {
                      if (draftBody === (screen.draftBody ?? "")) return;
                      saveScreen({ draftBody });
                    }}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      window.location.href = buildMailtoUrl({
                        to: screen.connectorEmail ?? "",
                        subject: draftSubject,
                        body: draftBody,
                      });
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    Open in Apple Mail
                  </Button>
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await markIntrosRequested({
                          screenId: screen.id,
                          candidateIds: [...checked],
                        });
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        setScreen(result.screen);
                        toast.success("Marked intro requested.");
                      });
                    }}
                  >
                    Mark intro requested
                  </Button>
                </div>
                <ul className="space-y-1">
                  {tier1.map((person) => (
                    <li key={person.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked.has(person.id)}
                          onCheckedChange={(value) => {
                            const next = new Set(checked);
                            if (value) next.add(person.id);
                            else next.delete(person.id);
                            setPicked([...next]);
                          }}
                        />
                        {person.name}
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Nothing is sent from JasonOS. Send from Mail, then mark it here.
                </p>
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function TierSelect({
  person,
  onChange,
}: {
  person: NetworkScreenCandidate;
  onChange: (id: string, patch: CandidatePatch) => void;
}) {
  return (
    <select
      className={selectClass}
      value={person.tier}
      aria-label={`Tier for ${person.name}`}
      onChange={(event) => onChange(person.id, { tier: event.target.value as Tier })}
    >
      {TIERS.map((tier) => (
        <option key={tier} value={tier}>
          {TIER_LABELS[tier]}
        </option>
      ))}
    </select>
  );
}

function BucketSelect({
  person,
  onChange,
}: {
  person: NetworkScreenCandidate;
  onChange: (id: string, patch: CandidatePatch) => void;
}) {
  return (
    <select
      className={selectClass}
      value={person.bucket}
      aria-label={`Bucket for ${person.name}`}
      onChange={(event) => onChange(person.id, { bucket: event.target.value as Bucket })}
    >
      {BUCKETS.map((bucket) => (
        <option key={bucket} value={bucket}>
          {BUCKET_LABELS[bucket]}
        </option>
      ))}
    </select>
  );
}

function QueueSelect({
  person,
  onChange,
}: {
  person: NetworkScreenCandidate;
  onChange: (id: string, patch: CandidatePatch) => void;
}) {
  return (
    <select
      className={selectClass}
      value={person.queueStatus}
      aria-label={`Queue status for ${person.name}`}
      onChange={(event) => onChange(person.id, { queueStatus: event.target.value as QueueStatus })}
    >
      {QUEUE_STATUSES.map((status) => (
        <option key={status} value={status}>
          {QUEUE_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  );
}
