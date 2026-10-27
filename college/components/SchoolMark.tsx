"use client";

import { useEffect, useState } from "react";
import { schoolFaviconCandidates, schoolMark } from "@/lib/types";

/**
 * School favicon (or letter fallback).
 * Uses a plain <img> so marks work inside Leaflet portals as well as normal React trees.
 * Tries DuckDuckGo then Google when the first source 404s.
 */
export function SchoolMark({ name, website }: { name: string; website: string }) {
  const candidates = schoolFaviconCandidates(website);
  const [index, setIndex] = useState(0);
  const src = candidates[index] ?? "";

  useEffect(() => {
    setIndex(0);
  }, [website]);

  if (!src) {
    return (
      <span className="school-mark" aria-hidden="true">
        {schoolMark(name)}
      </span>
    );
  }

  return (
    <span className="school-mark" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- plain img is reliable in Leaflet marker roots */}
      <img
        src={src}
        alt=""
        width={22}
        height={22}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={(event) => {
          // Google’s missing-icon globe is a tiny 16×16; treat it as a miss.
          if (
            src.includes("google.com/s2/favicons") &&
            event.currentTarget.naturalWidth > 0 &&
            event.currentTarget.naturalWidth <= 16
          ) {
            setIndex((prev) => prev + 1);
          }
        }}
        onError={() => {
          setIndex((prev) => prev + 1);
        }}
      />
    </span>
  );
}
