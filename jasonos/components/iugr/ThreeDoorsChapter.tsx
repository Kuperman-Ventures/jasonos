"use client";

import { useEffect, useId, useRef } from "react";
import { THREE_DOORS } from "@/lib/iugr/copy";
import {
  THREE_DOOR_IDS,
  THREE_DOORS_DATA,
  allDoorsExplored,
  type DoorDefinition,
  type DoorId,
} from "@/lib/iugr/threeDoors";

export type ThreeDoorsChapterProps = {
  exploredDoors: readonly DoorId[];
  activeDoorId: DoorId | null;
  onOpenDoor: (id: DoorId) => void;
  onCloseDoor: (id: DoorId) => void;
  onContinue: () => void;
  onBack: () => void;
  reducedMotion: boolean;
};

type DoorStatus = "unexplored" | "open" | "explored";

function getDoorStatus(
  id: DoorId,
  explored: readonly DoorId[],
  active: DoorId | null,
): DoorStatus {
  if (active === id) return "open";
  if (explored.includes(id)) return "explored";
  return "unexplored";
}

function statusLabel(status: DoorStatus): string {
  if (status === "open") return THREE_DOORS.statusOpen;
  if (status === "explored") return THREE_DOORS.statusExplored;
  return THREE_DOORS.statusUnexplored;
}

function DoorIllustration({ door }: { door: DoorDefinition }) {
  if (door.id === "road-ends") {
    return (
      <svg className="iugr-door-illust" viewBox="0 0 160 120" aria-hidden>
        <defs>
          <linearGradient id="iugr-road-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--iugr-accent)" stopOpacity="0.95" />
            <stop offset="65%" stopColor="var(--iugr-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--iugr-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M14 90 C46 86 58 72 80 62 C100 53 118 46 146 38"
          fill="none"
          stroke="url(#iugr-road-fade)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="146" cy="38" r="11" fill="var(--iugr-accent)" opacity="0.22" />
        <circle cx="146" cy="38" r="4.5" fill="var(--iugr-cream)" opacity="0.4" />
        <path
          d="M80 62 L74 53 M80 62 L88 55"
          stroke="var(--iugr-coral)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (door.id === "archive-closed") {
    return (
      <svg className="iugr-door-illust" viewBox="0 0 160 120" aria-hidden>
        <rect
          x="22"
          y="16"
          width="116"
          height="80"
          rx="9"
          fill="var(--iugr-panel-solid)"
          stroke="var(--iugr-violet)"
          strokeWidth="2"
        />
        <rect x="32" y="28" width="30" height="52" rx="2" fill="var(--iugr-violet)" opacity="0.38" />
        <rect x="66" y="28" width="30" height="52" rx="2" fill="var(--iugr-violet)" opacity="0.26" />
        <rect x="100" y="28" width="30" height="52" rx="2" fill="var(--iugr-violet)" opacity="0.18" />
        <rect x="50" y="48" width="60" height="24" rx="4" fill="var(--iugr-cream)" opacity="0.94" />
        <text
          x="80"
          y="64"
          textAnchor="middle"
          fill="#070b16"
          fontSize="10"
          fontWeight="700"
          fontFamily="var(--iugr-font), system-ui, sans-serif"
        >
          CLOSED
        </text>
        <rect x="120" y="74" width="14" height="10" rx="2" fill="var(--iugr-accent)" opacity="0.55" />
      </svg>
    );
  }

  return (
    <svg className="iugr-door-illust" viewBox="0 0 160 120" aria-hidden>
      <rect
        x="16"
        y="20"
        width="128"
        height="74"
        rx="11"
        fill="var(--iugr-panel-solid)"
        stroke="var(--iugr-coral)"
        strokeWidth="2"
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle
          key={i}
          cx={38 + i * 17}
          cy={48 + (i % 2) * 9}
          r="6.5"
          fill="var(--iugr-accent)"
          opacity={0.32 + i * 0.08}
        />
      ))}
      <path
        d="M32 82 H128"
        stroke="var(--iugr-cream-muted)"
        strokeWidth="2"
        strokeDasharray="4 4"
        opacity="0.55"
      />
    </svg>
  );
}

function DoorCard({
  door,
  status,
  onOpen,
  buttonRef,
}: {
  door: DoorDefinition;
  status: DoorStatus;
  onOpen: () => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={buttonRef}
      className={`iugr-door-card is-${status} iugr-door-tone-${door.number}`}
      style={{ ["--iugr-door-accent" as string]: `var(${door.accentVar})` }}
      onClick={onOpen}
      aria-label={`${door.label}: ${door.title}. ${statusLabel(status)}.`}
      data-status={status}
    >
      <span className="iugr-door-card-art" aria-hidden>
        <DoorIllustration door={door} />
      </span>
      <span className="iugr-door-card-copy">
        <span className="iugr-door-card-label">{door.label}</span>
        <span className="iugr-door-card-title">{door.title}</span>
        <span className="iugr-door-card-status">{statusLabel(status)}</span>
      </span>
    </button>
  );
}

function DoorDetail({
  door,
  onReturn,
  reducedMotion,
}: {
  door: DoorDefinition;
  onReturn: () => void;
  reducedMotion: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, [door.id]);

  return (
    <article
      className={`iugr-door-detail${reducedMotion ? " is-static" : " is-enter"}`}
      aria-labelledby={titleId}
      aria-label={THREE_DOORS.detailAria}
    >
      <p className="iugr-door-detail-label">{door.label}</p>
      <h2 id={titleId} ref={headingRef} className="iugr-door-detail-title" tabIndex={-1}>
        {door.title}
      </h2>

      <div className="iugr-door-detail-visual" aria-hidden>
        <DoorIllustration door={door} />
      </div>

      <p className="iugr-door-detail-concept">{door.concept}</p>
      <p className="iugr-door-detail-support">{door.support}</p>
      <p className="iugr-door-aside">{door.aside}</p>

      {door.caveat ? (
        <p className="iugr-door-caveat" role="note">
          {door.caveat}
        </p>
      ) : null}

      <p className="iugr-door-takeaway">
        <strong>Takeaway.</strong> {door.takeaway}
      </p>

      <details className="iugr-door-fieldnote">
        <summary>{THREE_DOORS.lookCloser}</summary>
        <p>
          <span className="iugr-door-fieldnote-kicker">{THREE_DOORS.fieldNoteLabel}. </span>
          {door.fieldNote}
        </p>
      </details>

      <div className="iugr-actions">
        <button type="button" className="iugr-btn iugr-btn-primary" onClick={onReturn}>
          {THREE_DOORS.returnToHub}
        </button>
      </div>
    </article>
  );
}

export function ThreeDoorsChapter({
  exploredDoors,
  activeDoorId,
  onOpenDoor,
  onCloseDoor,
  onContinue,
  onBack,
  reducedMotion,
}: ThreeDoorsChapterProps) {
  const complete = allDoorsExplored(exploredDoors);
  const doorButtonRefs = useRef<Partial<Record<DoorId, HTMLButtonElement | null>>>({});
  const returnFocusId = useRef<DoorId | null>(null);

  useEffect(() => {
    if (activeDoorId === null && returnFocusId.current) {
      doorButtonRefs.current[returnFocusId.current]?.focus();
      returnFocusId.current = null;
    }
  }, [activeDoorId]);

  const handleReturn = (id: DoorId) => {
    returnFocusId.current = id;
    onCloseDoor(id);
  };

  if (activeDoorId) {
    const door = THREE_DOORS_DATA[activeDoorId];
    return (
      <section className="iugr-panel iugr-three-doors" aria-labelledby="iugr-doors-title">
        <div className="iugr-label">{THREE_DOORS.chapterLabel}</div>
        <h1 id="iugr-doors-title" className="sr-only">
          {THREE_DOORS.title}: {door.title}
        </h1>
        <DoorDetail
          door={door}
          onReturn={() => handleReturn(activeDoorId)}
          reducedMotion={reducedMotion}
        />
      </section>
    );
  }

  return (
    <section className="iugr-panel iugr-three-doors" aria-labelledby="iugr-doors-title">
      <div className="iugr-label">{THREE_DOORS.chapterLabel}</div>
      <h1 id="iugr-doors-title" className="iugr-headline iugr-headline-sm">
        {THREE_DOORS.title}
      </h1>

      <p className="iugr-lead">{THREE_DOORS.transitionFromMachine}</p>
      <p className="iugr-body">{THREE_DOORS.transitionBridge}</p>
      <p className="iugr-lead">{THREE_DOORS.guideWelcome}</p>

      {!complete ? <p className="iugr-doors-prompt">{THREE_DOORS.hubPrompt}</p> : null}

      <p className="iugr-doors-progress" aria-live="polite">
        {THREE_DOORS.hubProgress}: {exploredDoors.length} / {THREE_DOOR_IDS.length}
      </p>

      <div className="iugr-doors-hub" role="group" aria-label={THREE_DOORS.hubAria}>
        {THREE_DOOR_IDS.map((id) => {
          const door = THREE_DOORS_DATA[id];
          const status = getDoorStatus(id, exploredDoors, activeDoorId);
          return (
            <DoorCard
              key={id}
              door={door}
              status={status}
              onOpen={() => onOpenDoor(id)}
              buttonRef={(node) => {
                doorButtonRefs.current[id] = node;
              }}
            />
          );
        })}
      </div>

      {complete ? (
        <div className="iugr-doors-synthesis" aria-labelledby="iugr-doors-synthesis-title">
          <h2 id="iugr-doors-synthesis-title" className="iugr-doors-synthesis-title">
            {THREE_DOORS.completionTitle}
          </h2>
          <ol className="iugr-doors-synthesis-list">
            <li>{THREE_DOORS.completionOne}</li>
            <li>{THREE_DOORS.completionTwo}</li>
            <li>{THREE_DOORS.completionThree}</li>
          </ol>
          <p className="iugr-doors-synthesis-close">{THREE_DOORS.completionClose}</p>
          <details className="iugr-door-fieldnote">
            <summary>{THREE_DOORS.lookCloser}</summary>
            <p>
              <span className="iugr-door-fieldnote-kicker">{THREE_DOORS.fieldNoteLabel}. </span>
              {THREE_DOORS.bostromNote}
            </p>
          </details>
        </div>
      ) : null}

      <div className="iugr-actions iugr-doors-nav">
        <button type="button" className="iugr-btn iugr-btn-ghost" onClick={onBack}>
          {THREE_DOORS.previousLabel}
        </button>
        {complete ? (
          <button type="button" className="iugr-btn iugr-btn-primary" onClick={onContinue}>
            {THREE_DOORS.continueLabel}
          </button>
        ) : (
          <p className="iugr-doors-continue-hint">Explore all three doors to continue.</p>
        )}
      </div>
    </section>
  );
}
