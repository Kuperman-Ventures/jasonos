"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ChooseButtons } from "@/components/iugr/deck/ChooseButtons";
import {
  CopyMachineStage,
  pullBodyLines,
} from "@/components/iugr/deck/CopyMachineStage";
import { TownStage } from "@/components/iugr/deck/TownStage";
import { SourcesDrawer } from "@/components/iugr/SourcesDrawer";
import {
  DECK,
  DECK_SECTIONS,
  QUESTION_REACTIONS,
  type Card,
  type CardLine,
  type SectionId,
  sectionStartIndex,
} from "@/lib/iugr/deck";
import {
  DEFAULT_PERSISTED,
  readPersisted,
  writePersisted,
  type DeckPersisted,
} from "@/lib/iugr/deckStorage";
import { FUTURE_ENTRIES } from "@/lib/iugr/episodes";
import { SERIES } from "@/lib/iugr/copy";
import { CLOSING_SCRIPT } from "@/lib/iugr/script";
import {
  evaluateScenario,
  type CivilizationReach,
  type ConsciousnessStance,
  type HistoryInterest,
} from "@/lib/iugr/scenarioEngine";
import {
  DEFAULT_PREFERENCES,
  readPreferences,
  systemPrefersReducedMotion,
  writePreferences,
} from "@/lib/iugr/preferences";
import type { ConsciousnessPremise, IugrPreferences } from "@/lib/iugr/types";
import { formatWholeNumber } from "@/lib/iugr/scenarioMath";
import { CLOSING } from "@/lib/iugr/sources";

const PULL_UNLOCK_AT = 9;

let memoryPrefs: IugrPreferences | null = null;
const prefListeners = new Set<() => void>();
function emitPrefs() {
  for (const l of prefListeners) l();
}
function subscribePrefs(l: () => void) {
  prefListeners.add(l);
  return () => {
    prefListeners.delete(l);
  };
}
function getPrefsSnapshot(): IugrPreferences {
  if (memoryPrefs) return memoryPrefs;
  const stored = readPreferences();
  memoryPrefs = {
    ...stored,
    reducedMotion: stored.reducedMotion || systemPrefersReducedMotion(),
  };
  return memoryPrefs;
}
function getServerPrefs(): IugrPreferences {
  return DEFAULT_PREFERENCES;
}
function updatePrefs(u: (p: IugrPreferences) => IugrPreferences) {
  memoryPrefs = u(getPrefsSnapshot());
  writePreferences(memoryPrefs);
  emitPrefs();
}

let memorySession: DeckPersisted | null = null;
const sessionListeners = new Set<() => void>();
function emitSession() {
  for (const l of sessionListeners) l();
}
function subscribeSession(l: () => void) {
  sessionListeners.add(l);
  return () => {
    sessionListeners.delete(l);
  };
}
function readSession(): DeckPersisted {
  if (memorySession) return memorySession;
  memorySession = readPersisted(DECK.length);
  return memorySession;
}
function getServerSession(): DeckPersisted {
  return { ...DEFAULT_PERSISTED, hintSeen: true };
}
function patchSession(patch: Partial<DeckPersisted>) {
  const next = { ...readSession(), ...patch };
  memorySession = next;
  writePersisted(next);
  emitSession();
}

function subscribeNever() {
  return () => {};
}
function clientTrue() {
  return true;
}
function serverFalse() {
  return false;
}

function CardLines({
  lines,
  prevLines,
  kind,
  reducedMotion,
}: {
  lines: CardLine[];
  prevLines: CardLine[];
  kind: Card["kind"];
  reducedMotion: boolean;
}) {
  return (
    <div
      className={[
        "iugr-deck-lines",
        kind === "section" ? "is-section" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {lines.map((line, i) => {
        const prev = prevLines[i];
        const isNew =
          !prev || prev.text !== line.text || prev.tone !== line.tone;
        return (
          <p
            key={i}
            className={[
              "iugr-deck-line",
              `is-${line.tone}`,
              kind === "section" && line.tone === "lead"
                ? "is-section-title"
                : "",
              kind === "section" && i === 0 && line.tone === "body"
                ? "is-kicker"
                : "",
              isNew && !reducedMotion ? "is-enter" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
}

function premiseFromChoice(id: string): ConsciousnessPremise | null {
  if (id === "yes" || id === "unsure" || id === "no") return id;
  return null;
}

function mindFromPremise(
  p: ConsciousnessPremise | null,
): ConsciousnessStance | null {
  if (p === "yes") return "yes";
  if (p === "no") return "no";
  if (p === "unsure") return "unknown";
  return null;
}

export function IugrDeckShell() {
  const prefs = useSyncExternalStore(
    subscribePrefs,
    getPrefsSnapshot,
    getServerPrefs,
  );
  const session = useSyncExternalStore(
    subscribeSession,
    readSession,
    getServerSession,
  );
  const isClient = useSyncExternalStore(
    subscribeNever,
    clientTrue,
    serverFalse,
  );

  const index = session.index;
  const [prevIndex, setPrevIndex] = useState(index);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [leverAnnounce, setLeverAnnounce] = useState("");
  const [choiceAnnounce, setChoiceAnnounce] = useState("");

  /** Live copy count on the pull card (session.copiedTowns is source of truth). */
  const copies = session.copiedTowns;

  const cardRef = useRef<HTMLDivElement>(null);
  const liveId = useId();
  const leverLiveId = useId();

  const card = DECK[index] ?? DECK[0]!;
  const prevCard = DECK[prevIndex] ?? card;
  const interaction = card.interaction;

  const pickDone =
    interaction?.type === "pick" && session.readerFigureIndex != null;
  const chooseValue =
    interaction?.type === "choose"
      ? (session[interaction.stateKey as keyof DeckPersisted] as
          | string
          | null
          | undefined)
      : null;
  const chooseDone =
    interaction?.type === "choose" &&
    chooseValue != null &&
    chooseValue !== "";
  const pullDone =
    interaction?.type === "pull" && copies >= PULL_UNLOCK_AT;
  const pullMaxed =
    interaction?.type === "pull" &&
    copies >= (interaction.stops[interaction.stops.length - 1] ?? 999);

  const waitingInteraction = Boolean(
    interaction &&
      ((interaction.type === "pick" && !pickDone) ||
        (interaction.type === "choose" && !chooseDone) ||
        (interaction.type === "pull" && !pullDone)),
  );
  const rightBlocked = waitingInteraction;

  const liveAnnounce = isClient
    ? card.lines.map((l) => l.text).join(" ")
    : "";

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      updatePrefs((prev) => ({
        ...prev,
        reducedMotion: prev.reducedMotion || media.matches,
      }));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [card.id]);

  const markHint = useCallback(() => {
    if (session.hintSeen) return;
    patchSession({ hintSeen: true });
  }, [session.hintSeen]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(DECK.length - 1, next));
      setPrevIndex(index);
      patchSession({ index: clamped });
      markHint();
    },
    [index, markHint],
  );

  const goNext = useCallback(() => {
    if (rightBlocked) return;
    if (index >= DECK.length - 1) return;
    goTo(index + 1);
  }, [goTo, index, rightBlocked]);

  const goBack = useCallback(() => {
    if (index <= 0) return;
    goTo(index - 1);
  }, [goTo, index]);

  const onPull = useCallback(() => {
    if (interaction?.type !== "pull") return;
    const stops = interaction.stops;
    const idx = stops.indexOf(copies as (typeof stops)[number]);
    const at = idx >= 0 ? idx : 0;
    if (at >= stops.length - 1) return;
    const next = stops[at + 1]!;
    patchSession({ copiedTowns: next });
    setLeverAnnounce(`Copied towns: ${formatWholeNumber(next)}`);
    markHint();
  }, [copies, interaction, markHint]);

  const onPick = useCallback(
    (figureIndex: number) => {
      if (interaction?.type !== "pick") return;
      const next =
        session.readerFigureIndex === figureIndex ? null : figureIndex;
      patchSession({ readerFigureIndex: next });
      setChoiceAnnounce(
        next == null
          ? "Selection cleared."
          : `You selected resident ${next + 1}.`,
      );
      markHint();
    },
    [interaction, markHint, session.readerFigureIndex],
  );

  const onChoose = useCallback(
    (optionId: string) => {
      if (interaction?.type !== "choose") return;
      const key = interaction.stateKey;
      const patch: Partial<DeckPersisted> = {};
      if (key === "copiesAreConscious") {
        const premise = premiseFromChoice(optionId);
        patch.copiesAreConscious = premise;
        if (session.consciousness == null) {
          patch.consciousness = mindFromPremise(premise);
        }
      } else if (key === "chosenDoor") {
        patch.chosenDoor = optionId;
      } else if (key === "civilizations") {
        patch.civilizations = optionId as CivilizationReach;
      } else if (key === "history") {
        patch.history = optionId as HistoryInterest;
      } else if (key === "consciousness") {
        patch.consciousness = optionId as ConsciousnessStance;
      }
      patchSession(patch);
      const label =
        interaction.options.find((o) => o.id === optionId)?.label ?? optionId;
      setChoiceAnnounce(`Selected: ${label}`);
      markHint();
    },
    [interaction, markHint, session.consciousness],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (menuOpen || sourcesOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === " ") {
        if (waitingInteraction) return;
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack, goNext, menuOpen, sourcesOpen, waitingInteraction]);

  const stage = card.stage;
  const silent = Boolean(stage?.silent);
  const showChrome = !silent;
  const progress = DECK.length <= 1 ? 1 : index / (DECK.length - 1);

  const displayCopies =
    interaction?.type === "pull"
      ? copies
      : (stage?.copies ?? copies);

  const pullLines =
    interaction?.type === "pull"
      ? pullBodyLines(copies, session.copiesAreConscious)
      : [];

  const chooseConsequence =
    interaction?.type === "choose" &&
    interaction.stateKey === "copiesAreConscious" &&
    chooseDone &&
    typeof chooseValue === "string"
      ? QUESTION_REACTIONS[chooseValue] ?? null
      : interaction?.type === "choose" &&
          interaction.stateKey === "chosenDoor" &&
          chooseDone
        ? "Recorded. There is no wrong answer."
        : null;

  const reading =
    stage?.reading
      ? evaluateScenario({
          civilizations: session.civilizations ?? "sometimes",
          history: session.history ?? "sometimes",
          consciousness:
            session.consciousness ??
            mindFromPremise(session.copiesAreConscious) ??
            "unknown",
        })
      : null;

  const wash =
    displayCopies <= 0
      ? "rgba(139,134,217,0.10)"
      : displayCopies === 1
        ? "rgba(232,131,111,0.10)"
        : displayCopies === 9
          ? "rgba(232,131,111,0.13)"
          : "rgba(232,131,111,0.16)";

  const runAgain = () => {
    patchSession({
      ...DEFAULT_PERSISTED,
      hintSeen: true,
      index: sectionStartIndex("copy-machine"),
    });
  };

  const sendEntry = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/iugr`
        : "https://jasonos.vercel.app/iugr";
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg(CLOSING.shareCopied);
    } catch {
      setShareMsg(CLOSING.shareFailed);
    }
  };

  return (
    <div
      className={[
        "iugr-root",
        "iugr-deck-root",
        prefs.highContrast ? "iugr-high-contrast" : "",
        silent ? "is-silent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-reduced-motion={prefs.reducedMotion ? "true" : "false"}
      style={{ ["--copy-wash" as string]: wash }}
    >
      <div className="iugr-sky" aria-hidden />

      <div
        className="iugr-deck"
        role="application"
        aria-label={`${SERIES.shortName} card deck`}
      >
        <button
          type="button"
          className="iugr-deck-zone zone-left"
          aria-label="Back"
          onClick={goBack}
          disabled={index <= 0}
        />
        <button
          type="button"
          className={[
            "iugr-deck-zone zone-right",
            rightBlocked ? "is-blocked" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Next"
          onClick={goNext}
          disabled={rightBlocked || index >= DECK.length - 1}
          style={rightBlocked ? { pointerEvents: "none" } : undefined}
        />

        <div
          ref={cardRef}
          className="iugr-deck-card"
          tabIndex={-1}
          data-kind={card.kind}
          data-card-id={card.id}
          data-section={card.section}
        >
          {showChrome ? (
            <div className="iugr-deck-chrome-spacer" aria-hidden />
          ) : null}

          <div className="iugr-deck-body">
            {stage?.show && stage.town ? (
              <div className="iugr-deck-stage">
                <TownStage
                  readerFigureIndex={session.readerFigureIndex}
                  interactive={interaction?.type === "pick" && !pickDone}
                  compact={Boolean(stage.townCompact)}
                  secondTown={
                    Boolean(stage.secondTown) &&
                    session.copiesAreConscious != null
                  }
                  premise={session.copiesAreConscious}
                  onPick={onPick}
                />
              </div>
            ) : null}

            {stage?.show &&
            !stage.town &&
            !stage.closingActions &&
            (stage.showLever || stage.copies != null || stage.silent) ? (
              <div className="iugr-deck-stage">
                <CopyMachineStage
                  copies={displayCopies}
                  showCounts={Boolean(stage.showCounts)}
                  showLever={Boolean(stage.showLever)}
                  silent={silent}
                  leverArmed={
                    interaction?.type === "pull" && !pullMaxed
                  }
                  leverDone={pullMaxed}
                  challengePips={stage.challengePips ?? 0}
                  premise={session.copiesAreConscious}
                  reducedMotion={prefs.reducedMotion}
                  onPull={onPull}
                  leverLiveId={leverLiveId}
                  showChallenge={interaction?.type === "pull"}
                />
              </div>
            ) : null}

            {stage?.reading && reading ? (
              <div className="iugr-deck-stage is-reading">
                <p className="iugr-deck-line is-lead">{reading.label}</p>
                <p className="iugr-deck-line is-body">{reading.explanation}</p>
              </div>
            ) : null}

            {stage?.closingActions ? (
              <div className="iugr-deck-stage is-actions">
                <div className="iugr-deck-choose-stack">
                  <button
                    type="button"
                    className="iugr-deck-choose-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      runAgain();
                    }}
                  >
                    {CLOSING_SCRIPT.actions.runAgain}
                  </button>
                  <button
                    type="button"
                    className="iugr-deck-choose-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSourcesOpen(true);
                    }}
                  >
                    {CLOSING_SCRIPT.actions.sources}
                  </button>
                  <button
                    type="button"
                    className="iugr-deck-choose-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      void sendEntry();
                    }}
                  >
                    {CLOSING_SCRIPT.actions.send}
                  </button>
                </div>
                {shareMsg ? (
                  <p className="iugr-deck-consequence">{shareMsg}</p>
                ) : null}
              </div>
            ) : null}

            {!stage?.show &&
            !stage?.reading &&
            !stage?.closingActions &&
            card.kind !== "section" ? (
              <div className="iugr-deck-stage is-empty" aria-hidden />
            ) : null}

            <div
              className={[
                "iugr-deck-text",
                card.kind === "section" ? "is-section" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {interaction?.type === "pull" && waitingInteraction ? (
                <span className="iugr-deck-lever-pill">Tap the lever</span>
              ) : null}

              {interaction?.type === "pull" ? (
                <div className="iugr-deck-lines">
                  {pullLines.map((text, i) => (
                    <p
                      key={`${copies}-${i}`}
                      className={[
                        "iugr-deck-line",
                        i === 0 ? "is-lead" : "is-body",
                        !prefs.reducedMotion ? "is-enter" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {text}
                    </p>
                  ))}
                </div>
              ) : (
                <CardLines
                  lines={card.lines}
                  prevLines={prevCard.id === card.id ? [] : prevCard.lines}
                  kind={card.kind}
                  reducedMotion={prefs.reducedMotion}
                />
              )}

              {interaction?.type === "choose" ? (
                <ChooseButtons
                  options={interaction.options}
                  selectedId={
                    typeof chooseValue === "string" ? chooseValue : null
                  }
                  disabled={false}
                  onChoose={onChoose}
                  consequence={chooseConsequence}
                />
              ) : null}

              {!session.hintSeen && isClient ? (
                <p className="iugr-deck-hint">
                  Tap right to continue, left to go back
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {showChrome ? (
          <header className="iugr-deck-chrome">
            <button
              type="button"
              className="iugr-deck-close"
              aria-label="Open section list"
              onClick={() => setMenuOpen(true)}
            >
              <X size={18} aria-hidden />
            </button>
            <div
              className="iugr-deck-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label="Entry progress"
            >
              <span
                className="iugr-deck-progress-fill"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </header>
        ) : null}
      </div>

      <div id={liveId} className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnounce}
      </div>
      <div
        id={leverLiveId}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {leverAnnounce}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {choiceAnnounce}
      </div>

      {menuOpen ? (
        <div className="iugr-deck-menu" role="dialog" aria-label="Sections">
          <div className="iugr-deck-menu-panel">
            <div className="iugr-deck-menu-head">
              <h2>{SERIES.shortName}</h2>
              <button
                type="button"
                className="iugr-deck-close"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <nav className="iugr-deck-menu-sections" aria-label="Sections">
              {DECK_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className="iugr-deck-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    goTo(sectionStartIndex(section.id as SectionId));
                  }}
                >
                  {section.title}
                </button>
              ))}
            </nav>
            <div className="iugr-deck-menu-other">
              <h3>Other entries</h3>
              <ul>
                {FUTURE_ENTRIES.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.title}</span>
                    <span className="iugr-deck-menu-status">
                      {entry.statusLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Link className="iugr-deck-menu-home" href="/">
              Back to JasonOS
            </Link>
            <button
              type="button"
              className="iugr-deck-menu-item is-ghost"
              onClick={() => {
                updatePrefs((p) => ({
                  ...p,
                  reducedMotion: !p.reducedMotion,
                }));
              }}
            >
              Reduce motion: {prefs.reducedMotion ? "On" : "Off"}
            </button>
          </div>
        </div>
      ) : null}

      <SourcesDrawer open={sourcesOpen} onOpenChange={setSourcesOpen} />
    </div>
  );
}
