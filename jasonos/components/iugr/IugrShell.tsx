"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ChapterId, IugrPreferences } from "@/lib/iugr/types";
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

  // Keep reduced-motion in sync if the OS preference changes mid-session.
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
          onRestart={() => setChapterId("opening")}
          onToggleReducedMotion={() =>
            updatePrefs((p) => ({ ...p, reducedMotion: !p.reducedMotion }))
          }
          onToggleHighContrast={() =>
            updatePrefs((p) => ({ ...p, highContrast: !p.highContrast }))
          }
        />

        <div className="iugr-main">
          <ChapterPlaceholder
            chapterId={chapterId}
            guideId={prefs.guideId}
            onNavigate={setChapterId}
          />
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
