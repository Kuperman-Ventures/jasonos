"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type {
  ChapterId,
  ConsciousnessPremise,
  IugrPreferences,
} from "@/lib/iugr/types";
import {
  DEFAULT_PREFERENCES,
  readPreferences,
  systemPrefersReducedMotion,
  writePreferences,
} from "@/lib/iugr/preferences";
import { EntryChrome } from "@/components/iugr/EntryChrome";
import { ChapterPlaceholder } from "@/components/iugr/ChapterPlaceholder";
import { FieldNoteLibrary } from "@/components/iugr/FieldNoteLibrary";
import { GuideSettings } from "@/components/iugr/GuideSettings";
import { OpeningStage } from "@/components/iugr/OpeningStage";
import { OriginalTownChapter } from "@/components/iugr/OriginalTownChapter";

let memoryPrefs: IugrPreferences | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getPrefsSnapshot(): IugrPreferences {
  if (memoryPrefs) return memoryPrefs;
  const stored = readPreferences();
  const systemMotion = systemPrefersReducedMotion();
  memoryPrefs = {
    ...stored,
    reducedMotion: stored.reducedMotion || systemMotion,
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
  emit();
}

export function IugrShell() {
  const prefs = useSyncExternalStore(
    subscribe,
    getPrefsSnapshot,
    getServerPrefsSnapshot,
  );
  const [chapterId, setChapterId] = useState<ChapterId>("opening");
  const [guideOpen, setGuideOpen] = useState(false);

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

  const setGuideId = useCallback((guideId: IugrPreferences["guideId"]) => {
    updatePrefs((prev) => ({ ...prev, guideId }));
  }, []);

  const setDetailLevel = useCallback(
    (detailLevel: IugrPreferences["detailLevel"]) => {
      updatePrefs((prev) => ({ ...prev, detailLevel }));
    },
    [],
  );

  const setConsciousnessPremise = useCallback(
    (consciousnessPremise: ConsciousnessPremise) => {
      updatePrefs((prev) => ({ ...prev, consciousnessPremise }));
    },
    [],
  );

  const restart = useCallback(() => {
    setChapterId("opening");
    updatePrefs((prev) => ({ ...prev, consciousnessPremise: null }));
  }, []);

  return (
    <div
      className={`iugr-root${prefs.highContrast ? " iugr-high-contrast" : ""}`}
      data-reduced-motion={prefs.reducedMotion ? "true" : "false"}
    >
      <div className="iugr-sky" aria-hidden />
      <div className="iugr-shell">
        <EntryChrome
          chapterId={chapterId}
          reducedMotion={prefs.reducedMotion}
          highContrast={prefs.highContrast}
          onNavigate={setChapterId}
          onOpenGuideSettings={() => setGuideOpen(true)}
          onRestart={restart}
          onToggleReducedMotion={() =>
            updatePrefs((p) => ({ ...p, reducedMotion: !p.reducedMotion }))
          }
          onToggleHighContrast={() =>
            updatePrefs((p) => ({ ...p, highContrast: !p.highContrast }))
          }
        />

        <div className="iugr-main">
          {chapterId === "opening" ? (
            <OpeningStage onBegin={() => setChapterId("original-town")} />
          ) : null}

          {chapterId === "original-town" ? (
            <OriginalTownChapter
              consciousnessPremise={prefs.consciousnessPremise}
              onSelectPremise={setConsciousnessPremise}
              onOpenGuideSettings={() => setGuideOpen(true)}
              onContinue={() => setChapterId("copy-machine")}
              onPrevious={() => setChapterId("opening")}
            />
          ) : null}

          {chapterId !== "opening" && chapterId !== "original-town" ? (
            <ChapterPlaceholder
              chapterId={chapterId}
              guideId={prefs.guideId}
              onNavigate={setChapterId}
            />
          ) : null}
        </div>

        <FieldNoteLibrary />
      </div>

      <GuideSettings
        open={guideOpen}
        onOpenChange={setGuideOpen}
        guideId={prefs.guideId}
        detailLevel={prefs.detailLevel}
        onSelectGuide={setGuideId}
        onDetailLevelChange={setDetailLevel}
      />
    </div>
  );
}
