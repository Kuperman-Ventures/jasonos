/**
 * Cadence card-specific types and constants.
 *
 * The CadenceInterval enum is now defined as a Contact field (migration 0013)
 * and re-exported from lib/outreach/types.ts. This module covers the legacy
 * card-body shape used by the "+ Add contact" sheet in Phase 1 (dual-write).
 *
 * Once Phase 2/3 consolidates reads to read straight from jasonos.contacts,
 * the card-body shape becomes a denormalized artifact and this file can go
 * away.
 */

import type { CadenceInterval } from "@/lib/outreach/types";

export { CADENCE_DAYS, type CadenceInterval } from "@/lib/outreach/types";

export type CadenceScheduleOption =
  | "asap"
  | "next_week"
  | "2_weeks"
  | "1_month"
  | "3_months"
  | "custom";

export const CADENCE_OBJECT_TYPE = "cadence_contact";

export interface CadenceCardBody {
  cadence_interval: CadenceInterval;
  next_touch_date: string | null;
  notes?: string | null;
  firm?: string | null;
}
