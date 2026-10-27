"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CircleNotch, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { DeckDetail, DeckSummary, AiHelpMode, AiHelpSources } from "@/lib/server-actions/decks";
import {
  getPersonContextPreview,
  listDecks,
  listPlaybooks,
  runAiHelp,
  undoAiHelp,
} from "@/lib/server-actions/decks";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";
import { searchContacts } from "@/lib/server-actions/outreach";
import {
  orderedAiHelpPresets,
  type AiHelpPreset,
} from "@/lib/live/ai-help-presets";

const ET = "America/New_York";

type PersonChip = { id: string; name: string; contextLine?: string | null };

function slideHasText(slide: DeckDetail["slides"][number]): boolean {
  return Boolean(slide.headline.trim() || slide.bullets.some((line) => line.trim()));
}

function defaultMode(deck: DeckDetail): AiHelpMode {
  return deck.slides.some(slideHasText) ? "add" : "replace";
}

function formatDoneTime(at: string): string {
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleTimeString("en-US", {
    timeZone: ET,
    hour: "numeric",
    minute: "2-digit",
  });
}

function labelClass() {
  return "text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]";
}

export function AiHelpPanel({
  deck,
  open,
  onClose,
  onUpdated,
}: {
  deck: DeckDetail;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [instructions, setInstructions] = useState("");
  const [mode, setMode] = useState<AiHelpMode>(() => defaultMode(deck));
  const [usePeople, setUsePeople] = useState(false);
  const [people, setPeople] = useState<PersonChip[]>([]);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleHits, setPeopleHits] = useState<{ id: string; name: string; firm: string | null }[]>([]);
  const [usePlaybook, setUsePlaybook] = useState(false);
  const [playbookId, setPlaybookId] = useState("");
  const [playbooks, setPlaybooks] = useState<DeckSummary[]>([]);
  const [useOpenField, setUseOpenField] = useState(false);
  const [openText, setOpenText] = useState("");
  const [useTranscripts, setUseTranscripts] = useState(false);
  const [transcriptDeckIds, setTranscriptDeckIds] = useState<string[]>([]);
  const [transcriptDecks, setTranscriptDecks] = useState<DeckSummary[]>([]);
  const [useMeeting, setUseMeeting] = useState(false);
  const [meetingCalendar, setMeetingCalendar] = useState(true);
  const [meetingEmail, setMeetingEmail] = useState(true);
  const [meetingWebsite, setMeetingWebsite] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const hasMeeting = Boolean(deck.meetingPrepId);

  const sourcePlaybookName = useMemo(() => {
    if (!deck.sourcePlaybookId) return null;
    return playbooks.find((row) => row.id === deck.sourcePlaybookId)?.name ?? null;
  }, [deck.sourcePlaybookId, playbooks]);

  const presets = useMemo(
    () =>
      orderedAiHelpPresets({
        deckName: deck.name,
        sourcePlaybookName,
      }),
    [deck.name, sourcePlaybookName]
  );

  const transcriptOptions = useMemo(
    () =>
      transcriptDecks.filter(
        (row) => row.id !== deck.id && row.hasTranscript && row.runEndedAt
      ),
    [transcriptDecks, deck.id]
  );

  useEffect(() => {
    setMode(defaultMode(deck));
  }, [deck.id, deck.slides]);

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setWarnings([]);
    void listPlaybooks().then((result) => {
      if (result.ok) setPlaybooks(result.playbooks);
    });
    void listDecks().then((result) => {
      if (result.ok) setTranscriptDecks(result.decks);
    });
  }, [open]);

  const loadPersonContextLine = useCallback(async (contactId: string) => {
    const result = await getPersonContextPreview(contactId);
    if (!result.ok) return null;
    return result.line;
  }, []);

  // Preselect meeting attendees with CRM contact ids when a meeting is linked.
  useEffect(() => {
    if (!deck.meetingPrepId) return;
    let cancelled = false;
    void getMeetingPrep(deck.meetingPrepId).then(async (result) => {
      if (cancelled || !result.ok) return;
      const chips: PersonChip[] = [];
      for (const attendee of result.prep.attendees) {
        if (!attendee.contactId) continue;
        const name = attendee.name?.trim() || attendee.email;
        chips.push({ id: attendee.contactId, name });
      }
      if (!chips.length) return;
      setPeople(chips);
      setUsePeople(true);
      const withLines = await Promise.all(
        chips.map(async (chip) => ({
          ...chip,
          contextLine: await loadPersonContextLine(chip.id),
        }))
      );
      if (!cancelled) setPeople(withLines);
    });
    return () => {
      cancelled = true;
    };
  }, [deck.meetingPrepId, loadPersonContextLine]);

  useEffect(() => {
    const q = peopleQuery.trim();
    if (q.length < 2) {
      setPeopleHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchContacts(q).then(setPeopleHits);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [peopleQuery]);

  const addPerson = (hit: { id: string; name: string }) => {
    setPeople((current) => {
      if (current.some((row) => row.id === hit.id)) return current;
      return [...current, { id: hit.id, name: hit.name, contextLine: null }];
    });
    setPeopleQuery("");
    setPeopleHits([]);
    void loadPersonContextLine(hit.id).then((line) => {
      setPeople((current) =>
        current.map((row) => (row.id === hit.id ? { ...row, contextLine: line } : row))
      );
    });
  };

  const applyPreset = (preset: AiHelpPreset) => {
    setInstructions(preset.instructions);
    setMode(preset.mode);
  };

  const buildSources = useCallback((): AiHelpSources => {
    const sources: AiHelpSources = {};
    if (usePeople && people.length) {
      sources.people = people.map((row) => row.id);
    }
    if (usePlaybook && playbookId.trim()) {
      sources.playbookId = playbookId.trim();
    }
    if (useOpenField && openText.trim()) {
      sources.openText = openText.trim();
    }
    if (useTranscripts && transcriptDeckIds.length) {
      sources.transcriptDeckIds = transcriptDeckIds;
    }
    if (useMeeting && hasMeeting) {
      sources.meeting = {
        calendar: meetingCalendar,
        email: meetingEmail,
        website: meetingWebsite,
      };
    }
    return sources;
  }, [
    usePeople,
    people,
    usePlaybook,
    playbookId,
    useOpenField,
    openText,
    useTranscripts,
    transcriptDeckIds,
    useMeeting,
    hasMeeting,
    meetingCalendar,
    meetingEmail,
    meetingWebsite,
  ]);

  const toggleTranscript = (id: string, checked: boolean) => {
    setTranscriptDeckIds((current) => {
      if (!checked) return current.filter((row) => row !== id);
      if (current.includes(id)) return current;
      if (current.length >= 3) {
        toast.message("You can include up to 3 transcripts.");
        return current;
      }
      return [...current, id];
    });
  };

  const onRun = () => {
    const trimmed = instructions.trim();
    if (!trimmed) {
      toast.error("Write what you want help with.");
      return;
    }
    if (mode === "replace" && deck.slides.some(slideHasText)) {
      if (!window.confirm("Start over replaces your current slides. Continue?")) return;
    }
    setStatus(null);
    setWarnings([]);
    start(async () => {
      setStatus("Reading sources…");
      const result = await runAiHelp(deck.id, {
        instructions: trimmed,
        mode,
        sources: buildSources(),
      });
      if (!result.ok) {
        setStatus(null);
        toast.error(result.error);
        return;
      }
      const time = formatDoneTime(result.at);
      setWarnings(result.warnings);
      setStatus(
        time
          ? `Done ${time}. Undo AI help restores your slides.`
          : "Done. Undo AI help restores your slides."
      );
      onUpdated();
    });
  };

  const onUndo = () => {
    start(async () => {
      const result = await undoAiHelp(deck.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatus(null);
      setWarnings([]);
      toast.success("Undo applied");
      onUpdated();
    });
  };

  if (!open) return null;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-[380px] overflow-y-auto border-l border-[var(--jos-line)] bg-[var(--jos-bg)] shadow-[var(--shadow-sm)]"
      aria-label="AI help"
    >
      <div className="flex items-center justify-between border-b border-[var(--jos-line)] px-4 py-3">
        <h2 className="text-[15px] font-bold text-[var(--jos-ink)]">AI help</h2>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      <div className="space-y-5 px-4 py-4">
        <div>
          <p className={labelClass()}>Presets</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-surface)] px-2 py-1 text-[12px] font-semibold text-[var(--jos-ink)] hover:bg-[var(--jos-bg)]"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass()} htmlFor="ai-help-instructions">
            Instructions
          </label>
          <Textarea
            id="ai-help-instructions"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={4}
            required
            placeholder="Draft a first-call deck for a recruiter"
            className="mt-2 border-[var(--jos-line)] bg-[var(--jos-surface)] text-[14px]"
          />
        </div>

        <div>
          <p className={labelClass()}>Context</p>
          <div className="mt-3 space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--jos-ink)]">
                <Checkbox
                  checked={usePeople}
                  onCheckedChange={(checked) => setUsePeople(checked === true)}
                />
                People
              </label>
              {usePeople ? (
                <div className="ml-6 space-y-2">
                  <div className="relative">
                    <Input
                      value={peopleQuery}
                      onChange={(event) => setPeopleQuery(event.target.value)}
                      placeholder="Search contacts"
                      className="border-[var(--jos-line)] bg-[var(--jos-surface)] text-[13px]"
                    />
                    {peopleHits.length > 0 ? (
                      <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-bg)] shadow-[var(--shadow-sm)]">
                        {peopleHits.map((hit) => (
                          <li key={hit.id}>
                            <button
                              type="button"
                              className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--jos-surface)]"
                              onClick={() => addPerson(hit)}
                            >
                              <span className="font-semibold">{hit.name}</span>
                              {hit.firm ? (
                                <span className="text-[var(--jos-muted)]">{hit.firm}</span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {people.length ? (
                    <div className="space-y-2">
                      {people.map((person) => (
                        <div key={person.id} className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-surface)] px-2 py-0.5 text-[12px]">
                            {person.name}
                            <button
                              type="button"
                              className="text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
                              aria-label={`Remove ${person.name}`}
                              onClick={() =>
                                setPeople((current) =>
                                  current.filter((row) => row.id !== person.id)
                                )
                              }
                            >
                              <X size={12} />
                            </button>
                          </span>
                          {person.contextLine ? (
                            <p className="text-[13px] text-[var(--jos-muted)]">{person.contextLine}</p>
                          ) : (
                            <p className="text-[13px] text-[var(--jos-muted)]">Reading person context…</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[var(--jos-muted)]">Add people from CRM (min 2 characters).</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--jos-ink)]">
                <Checkbox
                  checked={usePlaybook}
                  onCheckedChange={(checked) => setUsePlaybook(checked === true)}
                />
                Playbook
              </label>
              {usePlaybook ? (
                <select
                  value={playbookId}
                  onChange={(event) => setPlaybookId(event.target.value)}
                  className="ml-6 w-[calc(100%-1.5rem)] rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-surface)] px-2 py-1.5 text-[13px] text-[var(--jos-ink)]"
                >
                  <option value="">Choose a playbook</option>
                  {playbooks.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--jos-ink)]">
                <Checkbox
                  checked={useOpenField}
                  onCheckedChange={(checked) => setUseOpenField(checked === true)}
                />
                Open field
              </label>
              {useOpenField ? (
                <Textarea
                  value={openText}
                  onChange={(event) => setOpenText(event.target.value)}
                  rows={3}
                  placeholder="Paste notes, a job description, or anything else"
                  className="ml-6 w-[calc(100%-1.5rem)] border-[var(--jos-line)] bg-[var(--jos-surface)] text-[13px]"
                />
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--jos-ink)]">
                <Checkbox
                  checked={useTranscripts}
                  onCheckedChange={(checked) => setUseTranscripts(checked === true)}
                />
                Transcripts
              </label>
              {useTranscripts ? (
                <div className="ml-6 space-y-1.5">
                  {transcriptOptions.length === 0 ? (
                    <p className="text-[12px] text-[var(--jos-muted)]">No finished decks with transcripts yet.</p>
                  ) : (
                    transcriptOptions.map((row) => {
                      const checked = transcriptDeckIds.includes(row.id);
                      return (
                        <label
                          key={row.id}
                          className="flex items-center gap-2 text-[13px] text-[var(--jos-ink)]"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleTranscript(row.id, value === true)}
                          />
                          <span className="truncate">{row.name}</span>
                        </label>
                      );
                    })
                  )}
                  <p className="text-[11px] text-[var(--jos-muted)]">Up to 3 decks.</p>
                </div>
              ) : null}
            </div>

            {hasMeeting ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--jos-ink)]">
                  <Checkbox
                    checked={useMeeting}
                    onCheckedChange={(checked) => {
                      const on = checked === true;
                      setUseMeeting(on);
                      if (on) {
                        setMeetingCalendar(true);
                        setMeetingEmail(true);
                        setMeetingWebsite(true);
                      }
                    }}
                  />
                  Meeting
                </label>
                {useMeeting ? (
                  <div className="ml-6 space-y-1.5">
                    <label className="flex items-center gap-2 text-[13px] text-[var(--jos-ink)]">
                      <Checkbox
                        checked={meetingCalendar}
                        onCheckedChange={(checked) => setMeetingCalendar(checked === true)}
                      />
                      Calendar event
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--jos-ink)]">
                      <Checkbox
                        checked={meetingEmail}
                        onCheckedChange={(checked) => setMeetingEmail(checked === true)}
                      />
                      Email with attendees
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--jos-ink)]">
                      <Checkbox
                        checked={meetingWebsite}
                        onCheckedChange={(checked) => setMeetingWebsite(checked === true)}
                      />
                      Company website
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <p className={labelClass()}>Mode</p>
          <div className="mt-2 space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--jos-ink)]">
              <input
                type="radio"
                name="ai-help-mode"
                className="accent-[var(--jos-ink)]"
                checked={mode === "add"}
                onChange={() => setMode("add")}
              />
              Add to what is here
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--jos-ink)]">
              <input
                type="radio"
                name="ai-help-mode"
                className="accent-[var(--jos-ink)]"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              Start over
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--jos-line)] pt-4">
          <Button type="button" size="sm" disabled={pending} onClick={onRun}>
            {pending ? <CircleNotch className="animate-spin" size={14} aria-hidden /> : null}
            Run AI help
          </Button>
          {deck.hasAiUndo ? (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onUndo}>
              Undo AI help
            </Button>
          ) : null}
        </div>

        {pending && status ? (
          <p className="flex items-center gap-2 text-[13px] text-[var(--jos-muted)]">
            <CircleNotch className="animate-spin" size={14} aria-hidden />
            {status}
          </p>
        ) : null}

        {!pending && status ? (
          <p className="text-[13px] text-[var(--jos-ink)]">{status}</p>
        ) : null}

        {warnings.length ? (
          <ul className="space-y-1 text-[13px] text-[var(--jos-danger-text)]">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
