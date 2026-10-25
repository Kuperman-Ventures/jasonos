"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  SCREEN_STATUS_LABELS,
  WARMTHS,
  WARMTH_LABELS,
  type NetworkScreenDetail,
  type NetworkScreenListItem,
  type RelationshipWarmth,
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
  const [captureNote, setCaptureNote] = useState<string | null>(null);
  const [checkTick, setCheckTick] = useState(0);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [recommendTick, setRecommendTick] = useState(0);
  const createLock = useRef(false);
  const recommendedFor = useRef<string | null>(null);

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
      if (cancelled) return;
      if (!result.ok) {
        setCaptureNote(result.error);
        return;
      }
      setCaptureNote(null);
      setScreen(result.screen);
      if (result.screen.id !== initialScreenId) {
        toast.success(`Read ${result.screen.visibleCount} connections. Choosing three intros.`);
      }
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
    let cancelled = false;
    const requestedId = screenId;
    async function pull(manual: boolean) {
      const result = await getNetworkScreen(requestedId);
      if (cancelled) return;
      if (!result.ok) {
        setCaptureNote(result.error);
        return;
      }
      if (result.screen.id === requestedId && result.screen.status === "awaiting_capture") {
        if (manual) setCaptureNote("No import on this screen yet.");
        return;
      }
      setCaptureNote(null);
      setScreen(result.screen);
      toast.success(`Read ${result.screen.visibleCount} connections. Choosing three intros.`);
    }
    void pull(checkTick > 0);
    const timer = setInterval(() => void pull(false), 10000);
    function onVisible() {
      if (document.visibilityState === "visible") void pull(false);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [checkTick, screenId, screenStatus]);

  useEffect(() => {
    if (!screen || screen.status !== "captured") return;
    if (recommendedFor.current === `${screen.id}:${recommendTick}`) return;
    recommendedFor.current = `${screen.id}:${recommendTick}`;
    setRecommendError(null);
    startTransition(async () => {
      const result = await scoreNetworkScreen({ screenId: screen.id });
      if (!result.ok) {
        setRecommendError(result.error);
        return;
      }
      if (!result.screen.candidates.some((person) => person.tier === "tier1")) return;
      setScreen(result.screen);
      refreshList();
    });
  }, [recommendTick, screen]);

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
  const recommendations = (screen?.candidates.filter((person) => person.tier === "tier1") ?? []).slice(0, 3);
  const checked = new Set(picked ?? recommendations.map((person) => person.id));

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
                    {[
                      SCREEN_STATUS_LABELS[item.status],
                      item.tier1Count > 0
                        ? `${item.tier1Count} intros`
                        : item.status === "captured"
                          ? "Choosing 3 intros"
                          : null,
                      item.queuedCount > 0 ? `${item.queuedCount} queued` : null,
                      formatWhen(item.createdAt),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
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
            [2, "Read their network"],
            [3, "Three intros"],
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
              if (createLock.current) return;
              createLock.current = true;
              setFormError(null);
              startTransition(async () => {
                try {
                  const result = await createNetworkScreen({ contactId: contact.id });
                  if (!result.ok) {
                    setFormError(result.error);
                    return;
                  }
                  setScreen(result.screen);
                  setCreating(false);
                  refreshList();
                } finally {
                  createLock.current = false;
                }
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
            <li>Claude pages their connections in your Chrome.</li>
            <li>JasonOS reads the list and keeps the three people worth an introduction.</li>
          </ol>
          <Button type="button" variant="outline" onClick={() => setCheckTick((tick) => tick + 1)}>
            Check now
          </Button>
          {captureNote ? <p className="text-sm text-muted-foreground">{captureNote}</p> : null}
        </section>
      ) : null}

      {screen && step === 3 ? (
        <section className="space-y-6">
          {screen.status === "captured" ? (
            <div className="space-y-3">
              <p className="text-sm">
                Reading {screen.visibleCount} connections from {screen.connectorName} and choosing the three people to ask for an introduction to.
              </p>
              {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              {recommendError ? <p className="text-sm text-destructive">{recommendError}</p> : null}
              {recommendError ? (
                <Button type="button" onClick={() => setRecommendTick((tick) => tick + 1)}>
                  Try again
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-sm">
                {screen.totalCountLabel
                  ? `Read ${screen.visibleCount} of ${screen.totalCountLabel} connections. These are the people to ask ${screen.connectorName} to introduce you to. The rest of the list was not saved.`
                  : `Read ${screen.visibleCount} connections. These are the people to ask ${screen.connectorName} to introduce you to. The rest of the list was not saved.`}
              </p>

              <ol className="space-y-4">
                {recommendations.map((person, index) => (
                  <li key={person.id} className="space-y-3 rounded-lg border bg-card p-4">
                    <div>
                      <h3 className="font-semibold">
                        {index + 1}. {person.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {[person.title, person.company, person.headline].filter(Boolean).join(" · ") || "No headline captured"}
                      </p>
                    </div>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">Why this intro</span>
                      <Textarea
                        key={`${person.id}-why-${person.why ?? ""}`}
                        defaultValue={person.why ?? ""}
                        onBlur={(event) => {
                          if (event.target.value === (person.why ?? "")) return;
                          saveCandidate(person.id, { why: event.target.value });
                        }}
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">What to ask {screen.connectorName}</span>
                      <Textarea
                        key={`${person.id}-ask-${person.ask ?? ""}`}
                        defaultValue={person.ask ?? ""}
                        onBlur={(event) => {
                          if (event.target.value === (person.ask ?? "")) return;
                          saveCandidate(person.id, { ask: event.target.value });
                        }}
                      />
                    </label>
                  </li>
                ))}
              </ol>
              {recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No intro recommendations yet.</p>
              ) : null}

              <div className="space-y-3">
                <Button
                  type="button"
                  disabled={pending || recommendations.length === 0}
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
                  Draft the ask
                </Button>
                <p className="text-sm text-muted-foreground">
                  {screen.relationshipWarmth === "new"
                    ? "The note asks for the strongest introduction and mentions the other two."
                    : "The note asks for an introduction to each of these people."}
                </p>
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
                  {recommendations.map((person) => (
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
                        Asked about {person.name}
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Nothing is sent from JasonOS. Send from Mail, then mark it here. These people are not added to contacts.
                </p>
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
