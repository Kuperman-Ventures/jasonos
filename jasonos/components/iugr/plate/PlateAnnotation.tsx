"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type PlateAnnotationPoint = {
  x: number;
  y: number;
};

export type PlateAnnotationProps = {
  text: string;
  /**
   * Opt-in leader-line form. Without this, the annotation renders as a
   * plate caption (below the frame, no leader).
   */
  pointer?: {
    anchor: PlateAnnotationPoint;
    label: PlateAnnotationPoint;
  };
  className?: string;
};

const MAX_LEADER_PX = 40;
const MAX_POINTER_WORDS = 3;
const EDGE_PAD_PCT = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Field-guide labelling.
 * Default: caption — below the plate, full width, left aligned, no leader.
 * Opt-in pointer: short local leader (≤40px), mono uppercase label of three
 * words or fewer. Returns null when the pointer label is too long.
 */
export function PlateAnnotation({
  text,
  pointer,
  className,
}: PlateAnnotationProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [maxLeaderPct, setMaxLeaderPct] = useState(12);

  useLayoutEffect(() => {
    if (!pointer || !rootRef.current) return;
    const width = rootRef.current.clientWidth;
    if (width > 0) {
      setMaxLeaderPct((MAX_LEADER_PX / width) * 100);
    }
  }, [pointer]);

  if (!pointer) {
    return (
      <p
        className={["iugr-plate-annotation", "is-caption", className]
          .filter(Boolean)
          .join(" ")}
      >
        {text}
      </p>
    );
  }

  if (wordCount(text) > MAX_POINTER_WORDS) {
    return null;
  }

  const dx = pointer.label.x - pointer.anchor.x;
  const dy = pointer.label.y - pointer.anchor.y;
  const distance = Math.hypot(dx, dy);
  const scale = distance > maxLeaderPct ? maxLeaderPct / distance : 1;
  const endX = pointer.anchor.x + dx * scale;
  const endY = pointer.anchor.y + dy * scale;
  const textX = clamp(endX, EDGE_PAD_PCT, 100 - EDGE_PAD_PCT);
  const textY = clamp(endY, EDGE_PAD_PCT, 100 - EDGE_PAD_PCT);
  const align =
    textX < 35 ? "left" : textX > 65 ? "right" : "center";

  return (
    <div
      ref={rootRef}
      className={["iugr-plate-annotation", "is-pointer", className]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        className="iugr-plate-annotation-lead"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1={pointer.anchor.x}
          y1={pointer.anchor.y}
          x2={endX}
          y2={endY}
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={pointer.anchor.x} cy={pointer.anchor.y} r="1.1" />
      </svg>
      <p
        className="iugr-plate-annotation-text"
        data-align={align}
        style={{ left: `${textX}%`, top: `${textY}%` }}
      >
        {text}
      </p>
    </div>
  );
}
