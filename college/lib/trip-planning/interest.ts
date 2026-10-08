/** Interest level helpers for Trip planning maps and legends. */

import type { InterestLevel } from "@/lib/types";

export type TripInterestKey = "top" | "high" | "moderate" | "safety" | "none";

export const TRIP_INTEREST_ORDER: TripInterestKey[] = [
  "top",
  "high",
  "moderate",
  "safety",
  "none",
];

export const TRIP_INTEREST_LABEL: Record<TripInterestKey, string> = {
  top: "Top choice",
  high: "High interest",
  moderate: "Moderate interest",
  safety: "Safety / backup",
  none: "Interest not set",
};

export function tripInterestKey(level: InterestLevel | undefined): TripInterestKey {
  if (!level) return "none";
  return level;
}

export function tripInterestLabel(level: InterestLevel | undefined): string {
  return TRIP_INTEREST_LABEL[tripInterestKey(level)];
}

/** CSS data-level attribute value matching visit/interest chips. */
export function tripInterestDataLevel(level: InterestLevel | undefined): TripInterestKey {
  return tripInterestKey(level);
}
