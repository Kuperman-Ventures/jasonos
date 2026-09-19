"use client";

import { useEffect, useState } from "react";
import { seedSchools } from "./content";
import type { School } from "./types";

// Interest is editable by anyone until login exists.
// Later, only Kyle should set interestLevel.
export function useSchoolPipeline() {
  const [schools, setSchools] = useState<School[]>(() => seedSchools());
  const [persisted, setPersisted] = useState(false);
  const [loaded, setLoaded] = useState(false);

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

  return { schools, setSchools, persisted, loaded };
}
