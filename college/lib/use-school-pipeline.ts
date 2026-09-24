"use client";

import { useEffect, useRef, useState } from "react";
import { seedSchools } from "./content";
import { schoolNeedsCommonAppFill } from "./common-app-grid";
import { schoolNeedsScorecardFill } from "./college-scorecard";
import type { School } from "./types";

// Interest is editable by anyone signed in for now.
// Later, only Kyle (student) should set interestLevel.
export function useSchoolPipeline() {
  const [schools, setSchools] = useState<School[]>(() => seedSchools());
  const [persisted, setPersisted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scorecardBackfillStarted = useRef(false);
  const commonAppBackfillStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/schools");
        const body = (await response.json()) as { schools?: School[]; persisted?: boolean };
        if (cancelled) return;
        if (body.schools?.length) setSchools(body.schools);
        setPersisted(Boolean(body.persisted));
      } catch {
        if (!cancelled) setPersisted(false);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !persisted || scorecardBackfillStarted.current) return;
    if (!schools.some((school) => !school.archived && schoolNeedsScorecardFill(school))) return;
    scorecardBackfillStarted.current = true;
    let cancelled = false;
    async function backfill() {
      try {
        const response = await fetch("/api/schools/scorecard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backfill: true }),
        });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as {
          results?: Array<{ id: string; status: string }>;
        };
        const hits = (body.results ?? []).filter((item) => item.status === "hit");
        if (!hits.length) return;
        const refresh = await fetch("/api/schools");
        if (!refresh.ok || cancelled) return;
        const next = (await refresh.json()) as { schools?: School[] };
        if (next.schools?.length) setSchools(next.schools);
      } catch {
        // Scorecard backfill is best-effort; the list still loads without it.
      }
    }
    void backfill();
    return () => {
      cancelled = true;
    };
  }, [loaded, persisted, schools]);

  useEffect(() => {
    if (!loaded || !persisted || commonAppBackfillStarted.current) return;
    if (!schools.some((school) => !school.archived && schoolNeedsCommonAppFill(school))) return;
    commonAppBackfillStarted.current = true;
    let cancelled = false;
    async function backfill() {
      try {
        const response = await fetch("/api/schools/common-app", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backfill: true }),
        });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as {
          results?: Array<{ id: string; status: string }>;
        };
        const hits = (body.results ?? []).filter((item) => item.status === "hit");
        if (!hits.length) return;
        const refresh = await fetch("/api/schools");
        if (!refresh.ok || cancelled) return;
        const next = (await refresh.json()) as { schools?: School[] };
        if (next.schools?.length) setSchools(next.schools);
      } catch {
        // Common App backfill is best-effort; the list still loads without it.
      }
    }
    void backfill();
    return () => {
      cancelled = true;
    };
  }, [loaded, persisted, schools]);

  return { schools, setSchools, persisted, loaded };
}
