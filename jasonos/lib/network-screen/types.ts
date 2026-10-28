export const BUCKETS = [
  "unscored",
  "hiring_path",
  "recruiter",
  "peer_referral",
  "speaking_content",
  "not_relevant",
] as const;
export type Bucket = (typeof BUCKETS)[number];

export const TIERS = ["none", "tier1", "tier2"] as const;
export type Tier = (typeof TIERS)[number];

export const SCREEN_STATUSES = [
  "awaiting_capture",
  "captured",
  "scored",
  "drafted",
  "requested",
  "archived",
] as const;
export type ScreenStatus = (typeof SCREEN_STATUSES)[number];

export const QUEUE_STATUSES = [
  "queued",
  "intro_requested",
  "intro_made",
  "reached_out_direct",
  "hold",
  "dropped",
] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const WARMTHS = ["new", "warm", "expecting_review"] as const;
export type RelationshipWarmth = (typeof WARMTHS)[number];

export const BUCKET_LABELS: Record<Bucket, string> = {
  unscored: "Unscored",
  hiring_path: "Hiring path",
  recruiter: "Recruiter",
  peer_referral: "Peer referral",
  speaking_content: "Speaking / content",
  not_relevant: "Not relevant",
};

export const TIER_LABELS: Record<Tier, string> = {
  none: "None",
  tier1: "Tier 1",
  tier2: "Tier 2",
};

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  queued: "Queued",
  intro_requested: "Intro requested",
  intro_made: "Intro made",
  reached_out_direct: "Reached out direct",
  hold: "Hold",
  dropped: "Dropped",
};

export const SCREEN_STATUS_LABELS: Record<ScreenStatus, string> = {
  awaiting_capture: "Awaiting capture",
  captured: "Captured",
  scored: "Scored",
  drafted: "Drafted",
  requested: "Requested",
  archived: "Archived",
};

export const WARMTH_LABELS: Record<RelationshipWarmth, string> = {
  new: "New",
  warm: "Warm",
  expecting_review: "Expecting a review",
};

export type NetworkScreen = {
  id: string;
  connectorContactId: string;
  connectorLinkedinUrl: string;
  connectorName: string;
  connectorHeadline: string | null;
  connectorCompany: string | null;
  connectorLocation: string | null;
  connectorDegree: string | null;
  connectorEmail: string | null;
  partnerNote: string | null;
  relationshipWarmth: RelationshipWarmth;
  meetingNotesSummary: string | null;
  openCommitments: string | null;
  visibleCount: number;
  totalCountLabel: string | null;
  status: ScreenStatus;
  draftSubject: string | null;
  draftBody: string | null;
  includeBlurbsInEmail: boolean;
  requestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NetworkScreenCandidate = {
  id: string;
  screenId: string;
  name: string;
  headline: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  linkedinUrl: string | null;
  linkedinDegree: string | null;
  mutualConnections: string | null;
  bucket: Bucket;
  tier: Tier;
  why: string | null;
  ask: string | null;
  introBlurb: string | null;
  introBlurbGeneratedAt: string | null;
  nextAction: string | null;
  queueStatus: QueueStatus;
  introRequestedAt: string | null;
  contactId: string | null;
  scoredBy: string | null;
  sortOrder: number;
};

export type NetworkScreenDetail = NetworkScreen & {
  candidates: NetworkScreenCandidate[];
};

export type NetworkScreenListItem = {
  id: string;
  connectorName: string;
  status: ScreenStatus;
  visibleCount: number;
  tier1Count: number;
  queuedCount: number;
  createdAt: string;
};

export type PendingIntro = {
  id: string;
  screenId: string;
  name: string;
  title: string | null;
  company: string | null;
  connectorName: string;
  queueStatus: QueueStatus;
  introRequestedAt: string | null;
};

export function isBucket(value: string): value is Bucket {
  return (BUCKETS as readonly string[]).includes(value);
}

export function isTier(value: string): value is Tier {
  return (TIERS as readonly string[]).includes(value);
}

export function isQueueStatus(value: string): value is QueueStatus {
  return (QUEUE_STATUSES as readonly string[]).includes(value);
}

export function isWarmth(value: string): value is RelationshipWarmth {
  return (WARMTHS as readonly string[]).includes(value);
}

export function isScreenStatus(value: string): value is ScreenStatus {
  return (SCREEN_STATUSES as readonly string[]).includes(value);
}
