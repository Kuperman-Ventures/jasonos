export interface JobOpportunity {
  id: string;
  briefDate: string; // YYYY-MM-DD first seen
  /** Role line without the URL, e.g. "Chief Marketing Officer — Ladders: up to $450K". */
  title: string;
  company: string | null;
  compensation: string | null;
  /** Best click-through: job listing when resolved, else Gmail conversation. */
  url: string | null;
  /** Direct posting URL when extracted from the alert email. */
  jobUrl: string | null;
  /** Canonical Gmail conversation permalink (fallback). */
  gmailUrl: string | null;
  /** Keywords that match this opportunity (used for sort; not shown in UI). */
  matchedKeywords: string[];
}
