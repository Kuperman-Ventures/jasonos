"use client";

import { useEffect, useRef, useState } from "react";

/** Animate a displayed integer toward a target. Instant when reduced motion. */
export function useCountUp(target: number, reducedMotion: boolean): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    const from = displayRef.current;
    if (reducedMotion || from === target) {
      const id = requestAnimationFrame(() => {
        displayRef.current = target;
        setDisplay(target);
      });
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const duration = Math.min(400, Math.max(150, Math.abs(target - from) * 40));
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      const next = Math.round(from + (target - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion]);

  return display;
}
