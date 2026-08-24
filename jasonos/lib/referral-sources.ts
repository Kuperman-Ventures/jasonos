/** Named referral channels (Browning, Boardy, The Connective, Job Application, …).
 *  Each is a real contact row tagged `referral_source`; people linked via
 *  `referred_by_contact_id` get the corresponding badge on weekly reports. */

export const REFERRAL_SOURCE_TAG = "referral_source";

export const BROWNING_SOURCE_NAME = "browning";
export const JOB_APPLICATION_SOURCE_NAME = "job application";

export type ReferralSourceRow = {
  id: string;
  name: string;
  tags: string[] | null;
};

/** Resolve a named referral-source contact id (prefers the tagged row). */
export function findReferralSourceId(
  rows: Iterable<ReferralSourceRow>,
  sourceNameLower: string
): string | null {
  let fallback: string | null = null;
  for (const r of rows) {
    if (r.name.trim().toLowerCase() !== sourceNameLower) continue;
    if ((r.tags ?? []).includes(REFERRAL_SOURCE_TAG)) return r.id;
    if (!fallback) fallback = r.id;
  }
  return fallback;
}

/** True when this contact was introduced via the given referral source. */
export function isReferredBySource(
  referredById: string | null | undefined,
  sourceId: string | null
): boolean {
  return !!sourceId && referredById === sourceId;
}
