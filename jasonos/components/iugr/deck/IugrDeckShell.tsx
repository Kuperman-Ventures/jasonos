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
import { CopyMachineStage } from "@/components/iugr/deck/CopyMachineStage";
import {
  DECK,
  DECK_SECTIONS,
  type Card,
  type CardLine,
  sectionStartIndex,
} from "@/lib/iugr/deck";
import {
  readCopiedTowns,
  readDeckCardIndex,
  readHintSeen,
  writeCopiedTowns,
  writeDeckCardIndex,
  writeHintSeen,
} from "@/lib/iugr/deckStorage";
import { COUNT_ROW, formatCopiedShareLabel } from "@/lib/iugr/copyMachine";
import { FUTURE_ENTRIES } from "@/lib/iugr/episodes";
import { SERIES } from "@/lib/iugr/copy";
import {
  DEFAULT_PREFERENCES,
  readPreferences,
  systemPrefersReducedMotion,
  writePreferences,
} from "@/lib/iugr/preferences";
import type { IugrPreferences } from "@/lib/iugr/types";
import { formatWholeNumber } from "@/lib/iugr/scenarioMath";
import { useCountUp } from "@/lib/iugr/useCountUp";

const ADVANCE_SETTLE_MS = 600;
const PULL_ANIM_MS = 280;

let memoryPrefs: IugrPreferences | null = null;
const prefListeners = new Set<() => void>();

function emitPrefs() {
  for (const listener of prefListeners) listener();
}

function subscribePrefs(listener: () => void) {
  prefListeners.add(listener);
  return () => {
    prefListeners.delete(listener);
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

function getServerPrefsSnapshot(): IugrPreferences {
  return DEFAULT_PREFERENCES;
}

function updatePrefs(updater: (prev: IugrPreferences) => IugrPreferences) {
  const next = updater(getPrefsSnapshot());
  memoryPrefs = next;
  writePreferences(next);
  emitPrefs();
}

/** Client-only flag without setState-in-effect. */
function subscribeNever() {
  return () => {};
}
function getClientTrue() {
  return true;
}
function getServerFalse() {
  return false;
}

type DeckSession = {
  index: number;
  hintSeen: boolean;
  copiedTowns: number;
};

let memorySession: DeckSession | null = null;
const sessionListeners = new Set<() => void>();

function emitSession() {
  for (const listener of sessionListeners) listener();
}

function subscribeSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function readSession(): DeckSession {
  if (memorySession) return memorySession;
  const index = readDeckCardIndex(DECK.length);
  memorySession = {
    index,
    hintSeen: readHintSeen(),
    copiedTowns: readCopiedTowns(),
  };
  return memorySession;
}

function getServerSession(): DeckSession {
  return { index: 0, hintSeen: true, copiedTowns: 0 };
}

function patchSession(patch: Partial<DeckSession>) {
  const prev = readSession();
  const next = { ...prev, ...patch };
  memorySession = next;
  if (patch.index != null) writeDeckCardIndex(patch.index);
  if (patch.hintSeen === true) writeHintSeen();
  if (patch.copiedTowns != null) writeCopiedTowns(patch.copiedTowns);
  emitSession();
}

function DeckCountRow({
  copies,
  reducedMotion,
}: {
  copies: number;
  reducedMotion: boolean;
}) {
  const originals = 100;
  const displayCopies = useCountUp(copies * 100, reducedMotion);
  const shareLabel = formatCopiedShareLabel(copies);
  const muted = copies === 0;
  const originalShare = copies === 0 ? 100 : 100 / (1 + copies);
  const copyShare = 100 - originalShare;

  return (
    <div className="iugr-deck-count-row">
      <div className="iugr-deck-count-groups">
        <div className="iugr-deck-count-group">
          <span className="iugr-deck-count-label">{COUNT_ROW.originals}</span>
          <span className="iugr-deck-count-value is-chartreuse">
            {formatWholeNumber(originals)}
          </span>
        </div>
        <div className="iugr-deck-count-group">
          <span className="iugr-deck-count-label">{COUNT_ROW.copies}</span>
          <span
            className={[
              "iugr-deck-count-value",
              muted ? "is-muted" : "is-coral",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {formatWholeNumber(displayCopies)}
          </span>
        </div>
        <div className="iugr-deck-count-group">
          <span className="iugr-deck-count-label">{COUNT_ROW.copiedShare}</span>
          <span
            className={[
              "iugr-deck-count-value",
              muted ? "is-muted" : "is-coral",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {shareLabel}
          </span>
        </div>
      </div>
      <div className="iugr-deck-proportion" aria-hidden>
        <span
          className="iugr-deck-proportion-original"
          style={{ width: `${originalShare}%` }}
        />
        <span
          className="iugr-deck-proportion-copy"
          style={{ width: `${copyShare}%` }}
        />
      </div>
    </div>
  );
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
        const isNew = !prev || prev.text !== line.text || prev.tone !== line.tone;
        return (
          <p
            key={i}
            className={[
              "iugr-deck-line",
              `is-${line.tone}`,
              kind === "section" ? "is-section-title" : "",
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

export function IugrDeckShell() {
  const prefs = useSyncExternalStore(
    subscribePrefs,
    getPrefsSnapshot,
    getServerPrefsSnapshot,
  );
  const session = useSyncExternalStore(
    subscribeSession,
    readSession,
    getServerSession,
  );
  const isClient = useSyncExternalStore(
    subscribeNever,
    getClientTrue,
    getServerFalse,
  );

  const index = session.index;
  const [prevIndex, setPrevIndex] = useState(index);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pullCopies, setPullCopies] = useState<number | null>(null);
  const [pullPending, setPullPending] = useState(false);
  const [leverAnnounce, setLeverAnnounce] = useState("");

  const cardRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveId = useId();
  const leverLiveId = useId();

  const card = DECK[index] ?? DECK[0]!;
  const prevCard = DECK[prevIndex] ?? card;
  const waitingPull =
    card.interaction?.type === "pull" && !pullPending;
  const rightBlocked = waitingPull || pullPending;
  const liveAnnounce = isClient
    ? card.lines.map((l) => l.text).join(" ")
    : "";
  const displayCopies =
    pullCopies ?? card.stage?.copies ?? session.copiedTowns;

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

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const markHint = useCallback(() => {
    if (session.hintSeen) return;
    patchSession({ hintSeen: true });
  }, [session.hintSeen]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(DECK.length - 1, next));
      setPrevIndex(index);
      setPullPending(false);
      setPullCopies(null);
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
    if (card.interaction?.type !== "pull" || pullPending) return;
    const to = card.interaction.to;
    setPullPending(true);
    setPullCopies(to);
    patchSession({ copiedTowns: to });
    setLeverAnnounce(`Copied towns: ${formatWholeNumber(to)}`);
    markHint();
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const delay = prefs.reducedMotion
      ? ADVANCE_SETTLE_MS
      : Math.max(ADVANCE_SETTLE_MS, PULL_ANIM_MS + 320);
    advanceTimer.current = setTimeout(() => {
      const nextIndex = Math.min(DECK.length - 1, index + 1);
      setPrevIndex(index);
      setPullPending(false);
      setPullCopies(null);
      patchSession({ index: nextIndex, copiedTowns: to });
    }, delay);
  }, [card.interaction, index, markHint, prefs.reducedMotion, pullPending]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (menuOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === " ") {
        if (waitingPull) return;
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack, goNext, menuOpen, waitingPull]);

  const stage = card.stage;
  const showStage = Boolean(stage?.show);
  const silent = Boolean(stage?.silent);
  const showCounts = Boolean(stage?.showCounts) && !silent;
  const showChrome = !silent;
  const progress = DECK.length <= 1 ? 1 : index / (DECK.length - 1);
  const wash =
    displayCopies <= 0
      ? "rgba(139,134,217,0.10)"
      : displayCopies === 1
        ? "rgba(232,131,111,0.10)"
        : displayCopies === 9
          ? "rgba(232,131,111,0.13)"
          : "rgba(232,131,111,0.16)";

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
        >
          {showChrome ? (
            <div className="iugr-deck-chrome-spacer" aria-hidden />
          ) : null}

          <div className="iugr-deck-body">
            {showStage && stage ? (
              <div className="iugr-deck-stage">
                <CopyMachineStage
                  copies={displayCopies}
                  showLever={Boolean(stage.showLever)}
                  silent={silent}
                  leverArmed={waitingPull}
                  reducedMotion={prefs.reducedMotion}
                  onPull={onPull}
                  leverLiveId={leverLiveId}
                />
              </div>
            ) : card.kind === "section" ? null : (
              <div className="iugr-deck-stage is-empty" aria-hidden />
            )}

            <div
              className={[
                "iugr-deck-text",
                card.kind === "section" ? "is-section" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {showCounts ? (
                <DeckCountRow
                  copies={displayCopies}
                  reducedMotion={prefs.reducedMotion}
                />
              ) : null}

              {waitingPull ? (
                <span className="iugr-deck-lever-pill">Tap the lever</span>
              ) : null}

              <CardLines
                lines={card.lines}
                prevLines={prevCard.id === card.id ? [] : prevCard.lines}
                kind={card.kind}
                reducedMotion={prefs.reducedMotion}
              />
            </div>
          </div>

          {!session.hintSeen && isClient ? (
            <p className="iugr-deck-hint" aria-hidden>
              Tap right to continue, left to go back
            </p>
          ) : null}
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
                    goTo(sectionStartIndex(section.id));
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
    </div>
  );
}
