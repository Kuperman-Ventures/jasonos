"use client";

import { useEffect, useRef } from "react";
import {
  activityIconRequestKey,
  pickActivityIcon,
  type ActivityIconId,
} from "@/lib/activity-icons";
import { upsertActivity, type ActivitiesJournal, type Activity } from "@/lib/activities-journal";

async function fetchActivityIcon(activity: Activity): Promise<ActivityIconId> {
  try {
    const res = await fetch("/api/activities/icon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: activity.name,
        category: activity.category,
        organization: activity.organization,
      }),
    });
    if (!res.ok) return pickActivityIcon(activity);
    const body = (await res.json()) as { icon?: unknown };
    return pickActivityIcon({ ...activity, icon: typeof body.icon === "string" ? body.icon : undefined });
  } catch {
    return pickActivityIcon(activity);
  }
}

/** Ask AI (with a keyword fallback) for an icon and persist it on the activity. */
export function useEnsureActivityIcons(
  journal: ActivitiesJournal,
  onChange: (next: ActivitiesJournal) => void,
  enabled: boolean,
) {
  const journalRef = useRef(journal);
  const onChangeRef = useRef(onChange);
  const requested = useRef(new Map<string, string>());
  const inFlight = useRef(new Set<string>());

  journalRef.current = journal;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    for (const activity of journal.activities) {
      const key = activityIconRequestKey(activity);
      if (requested.current.get(activity.id) === key) continue;
      if (inFlight.current.has(activity.id)) continue;
      inFlight.current.add(activity.id);
      void fetchActivityIcon(activity).then((icon) => {
        inFlight.current.delete(activity.id);
        requested.current.set(activity.id, key);
        const current = journalRef.current.activities.find((row) => row.id === activity.id);
        if (!current) return;
        if (activityIconRequestKey(current) !== key) return;
        if (current.icon === icon) return;
        onChangeRef.current(upsertActivity(journalRef.current, { ...current, icon }));
      });
    }
  }, [enabled, journal.activities]);
}
