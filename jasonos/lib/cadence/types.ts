export type CadenceInterval =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "none";

export type CadenceScheduleOption =
  | "asap"
  | "next_week"
  | "2_weeks"
  | "1_month"
  | "3_months"
  | "custom";

export const CADENCE_DAYS: Record<Exclude<CadenceInterval, "none">, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
};

export const CADENCE_OBJECT_TYPE = "cadence_contact";

export interface CadenceCardBody {
  cadence_interval: CadenceInterval;
  next_touch_date: string | null;
  notes?: string | null;
  firm?: string | null;
}
