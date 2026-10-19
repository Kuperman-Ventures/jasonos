/** A contact is thin when the draft would have to guess who they are. */
export function isContactThin(
  contact: {
    title: string | null;
    companyId: string | null;
    linkedinUrl: string | null;
    researchAt: string | Date | null;
  },
  now: Date = new Date()
): boolean {
  const title = contact.title?.trim() ?? "";
  const companyId = contact.companyId?.trim() ?? "";
  const linkedinUrl = contact.linkedinUrl?.trim() ?? "";
  if (!title || !companyId || !linkedinUrl) return true;
  if (!contact.researchAt) return true;
  const at = contact.researchAt instanceof Date ? contact.researchAt.getTime() : Date.parse(contact.researchAt);
  if (Number.isNaN(at)) return true;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  return now.getTime() - at > ninetyDaysMs;
}
