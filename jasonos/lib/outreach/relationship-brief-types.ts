export type BriefSourceType = "email" | "meeting" | "note" | "crm";

export interface BriefSourceRef {
  type: BriefSourceType;
  id: string;
  date: string;
}

export interface BriefCitedItem {
  text: string;
  source: BriefSourceRef;
}

export type BriefCommitmentStatus = "awaiting" | "open" | "overdue" | "done";
export type BriefCommitmentDirection = "theirs" | "mine";

export interface BriefCommitment extends BriefCitedItem {
  direction: BriefCommitmentDirection;
  status: BriefCommitmentStatus;
  due?: string | null;
}

export interface BriefNextMove {
  text: string;
  tone: "yellow" | "cyan" | "magenta";
  jump: "log_touch" | "generate_intro";
}

export interface RelationshipBrief {
  contactId: string;
  generatedAt: string;
  promptVersion: number;
  sources: string[];
  summary: string | null;
  helped: BriefCitedItem[];
  topics: BriefCitedItem[];
  commitments: BriefCommitment[];
  remember: BriefCitedItem[];
  nextMove: BriefNextMove | null;
  stale: boolean;
}

export interface BriefStats {
  meetingsHeld: number;
  introsOffered: number;
  introsMade: number;
  daysSinceLastTouch: number | null;
}
