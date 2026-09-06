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
import { ClosingChapter } from "@/components/iugr/ClosingChapter";
import { CopyMachineChapter } from "@/components/iugr/CopyMachineChapter";
import { ThreeDoorsChapter } from "@/components/iugr/ThreeDoorsChapter";
import { AssumptionArcadeChapter } from "@/components/iugr/AssumptionArcadeChapter";
import { EvidenceScannerChapter } from "@/components/iugr/EvidenceScannerChapter";
import { FieldNoteLibrary } from "@/components/iugr/FieldNoteLibrary";
import { GuideSettings } from "@/components/iugr/GuideSettings";
import { OpeningStage } from "@/components/iugr/OpeningStage";
import { OriginalTownChapter } from "@/components/iugr/OriginalTownChapter";
import { SourcesDrawer } from "@/components/iugr/SourcesDrawer";
import { TheCatchChapter } from "@/components/iugr/TheCatchChapter";
import type { DoorId } from "@/lib/iugr/threeDoors";
import { markDoorExplored } from "@/lib/iugr/threeDoors";
import {
  DEFAULT_SCENARIO_ASSUMPTIONS,
  type ScenarioAssumptions,
} from "@/lib/iugr/scenarioEngine";
import type {
  ClaimClassId,
  EvidenceClaimId,
} from "@/lib/iugr/evidenceClaims";
import type { CatchCaveatId } from "@/lib/iugr/theCatch";

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
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copiedTowns, setCopiedTowns] = useState(0);
  const [copyHasInteracted, setCopyHasInteracted] = useState(false);
  const [copyReachedNine, setCopyReachedNine] = useState(false);
  const [exploredDoors, setExploredDoors] = useState<DoorId[]>([]);
  const [activeDoorId, setActiveDoorId] = useState<DoorId | null>(null);
  const [arcadeAssumptions, setArcadeAssumptions] = useState<ScenarioAssumptions>(
    DEFAULT_SCENARIO_ASSUMPTIONS,
  );
  const [classifiedClaims, setClassifiedClaims] = useState<
    Partial<Record<EvidenceClaimId, ClaimClassId>>
  >({});
  const [activeClaimId, setActiveClaimId] = useState<EvidenceClaimId | null>(
    null,
  );
  const [inspectedCaveatIds, setInspectedCaveatIds] = useState<CatchCaveatId[]>(
    [],
  );

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

  const handleCopiedTownsChange = useCallback(
    (
      next: number,
      meta: { interacted: boolean; reachedNine: boolean },
    ) => {
      setCopiedTowns(next);
      setCopyHasInteracted(meta.interacted);
      setCopyReachedNine(meta.reachedNine);
    },
    [],
  );

  const restart = useCallback(() => {
    setChapterId("opening");
    setCopiedTowns(0);
    setCopyHasInteracted(false);
    setCopyReachedNine(false);
    setExploredDoors([]);
    setActiveDoorId(null);
    setArcadeAssumptions(DEFAULT_SCENARIO_ASSUMPTIONS);
    setClassifiedClaims({});
    setActiveClaimId(null);
    setInspectedCaveatIds([]);
    setSourcesOpen(false);
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
          onOpenSources={() => setSourcesOpen(true)}
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

          {chapterId === "copy-machine" ? (
            <CopyMachineChapter
              consciousnessPremise={prefs.consciousnessPremise}
              copiedTowns={copiedTowns}
              hasInteracted={copyHasInteracted}
              reachedNine={copyReachedNine}
              onCopiedTownsChange={handleCopiedTownsChange}
              onContinue={() => setChapterId("three-doors")}
              onBack={() => setChapterId("original-town")}
              reducedMotion={prefs.reducedMotion}
            />
          ) : null}

          {chapterId === "three-doors" ? (
            <ThreeDoorsChapter
              exploredDoors={exploredDoors}
              activeDoorId={activeDoorId}
              onOpenDoor={(id) => setActiveDoorId(id)}
              onCloseDoor={(id) => {
                setExploredDoors((prev) => markDoorExplored(prev, id));
                setActiveDoorId(null);
              }}
              onContinue={() => setChapterId("assumption-arcade")}
              onBack={() => {
                setActiveDoorId(null);
                setChapterId("copy-machine");
              }}
              reducedMotion={prefs.reducedMotion}
            />
          ) : null}

          {chapterId === "assumption-arcade" ? (
            <AssumptionArcadeChapter
              assumptions={arcadeAssumptions}
              onAssumptionsChange={setArcadeAssumptions}
              onContinue={() => setChapterId("evidence-scanner")}
              onBack={() => setChapterId("three-doors")}
              reducedMotion={prefs.reducedMotion}
            />
          ) : null}

          {chapterId === "evidence-scanner" ? (
            <EvidenceScannerChapter
              classifiedClaims={classifiedClaims}
              activeClaimId={activeClaimId}
              onOpenClaim={(id) => setActiveClaimId(id)}
              onClassifyClaim={(id, choice) => {
                setClassifiedClaims((prev) => ({ ...prev, [id]: choice }));
              }}
              onCloseClaim={() => setActiveClaimId(null)}
              onContinue={() => setChapterId("the-catch")}
              onBack={() => {
                setActiveClaimId(null);
                setChapterId("assumption-arcade");
              }}
              reducedMotion={prefs.reducedMotion}
            />
          ) : null}

          {chapterId === "the-catch" ? (
            <TheCatchChapter
              inspectedCaveatIds={inspectedCaveatIds}
              onInspectCaveat={(id) => {
                setInspectedCaveatIds((prev) =>
                  prev.includes(id) ? prev : [...prev, id],
                );
              }}
              onContinue={() => setChapterId("closing")}
              onBack={() => setChapterId("evidence-scanner")}
              reducedMotion={prefs.reducedMotion}
            />
          ) : null}

          {chapterId === "closing" ? (
            <ClosingChapter
              onExploreCopyMachine={() => setChapterId("copy-machine")}
              onOpenSources={() => setSourcesOpen(true)}
              onBack={() => setChapterId("the-catch")}
            />
          ) : null}

          {chapterId !== "opening" &&
          chapterId !== "original-town" &&
          chapterId !== "copy-machine" &&
          chapterId !== "three-doors" &&
          chapterId !== "assumption-arcade" &&
          chapterId !== "evidence-scanner" &&
          chapterId !== "the-catch" &&
          chapterId !== "closing" ? (
            <ChapterPlaceholder
              chapterId={chapterId}
              guideId={prefs.guideId}
              onNavigate={setChapterId}
            />
          ) : null}
        </div>

        {chapterId === "opening" ? <FieldNoteLibrary /> : null}
      </div>

      <GuideSettings
        open={guideOpen}
        onOpenChange={setGuideOpen}
        guideId={prefs.guideId}
        detailLevel={prefs.detailLevel}
        onSelectGuide={setGuideId}
        onDetailLevelChange={setDetailLevel}
      />

      <SourcesDrawer open={sourcesOpen} onOpenChange={setSourcesOpen} />
    </div>
  );
}
