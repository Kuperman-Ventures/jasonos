// Browning Networking handoffs. Tracy's copy-you email becomes a reply
// with times Jason picks on a calendar. No scoring.

export type HandoffSlot = {
  id: string;
  start: string;
  end: string;
};

export type BusyBlock = {
  start: string;
  end: string;
  allDay?: boolean;
  title: string;
};

export type HandoffBrief = {
  who: string;
  why: string;
  overlap: string;
  questions: string[];
  ask: string;
};

export type HandoffStatus =
  | "times_ready"
  | "draft_ready"
  | "acted_on"
  | "booked"
  | "brief_ready"
  | "thank_you_ready"
  | "dismissed";

export type ParsedHandoff = {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  availabilityNote: string | null;
  quotedReply: string | null;
  whyTheyReplied: string | null;
  title: string | null;
  company: string | null;
};

export type AvailabilityWindow = {
  earliestStartMin: number;
  latestStartMin: number;
  weekdays: number[] | null;
};

export const TRACY_EMAIL = "traceys@executivejobsearch.net";
// Tracy writes "Executive Networking with Jason Kuperman" and does not put a
// period right after Networking. Match the phrase, not one exact sentence.
export const HANDOFF_OPENING =
  "Thank you for your reply and interest in Executive Networking";

export const SLOT_MINUTES = 30;
export const BUSINESS_DAY_BUFFER = 3;
export const LOOKAHEAD_BUSINESS_DAYS = 10;

export type HandoffRecord = {
  id: string;
  gmailAccount: string;
  gmailThreadId: string | null;
  subject: string | null;
  receivedAt: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl: string | null;
  contactTitle: string | null;
  contactCompany: string | null;
  availabilityNote: string | null;
  whyTheyReplied: string | null;
  existingContactId: string | null;
  createdContactId: string | null;
  slots: HandoffSlot[];
  draftBody: string | null;
  gmailDraftId: string | null;
  gmailDraftUrl: string | null;
  callTitle: string | null;
  callStartsAt: string | null;
  callEndsAt: string | null;
  brief: HandoffBrief | null;
  thankYouBody: string | null;
  thankYouSource: string | null;
  status: HandoffStatus;
};

export type BrowningNetworkingPage = {
  configured: boolean;
  handoffs: HandoffRecord[];
  busy: BusyBlock[];
  eligibleYmd: string;
  lastYmd: string;
  error?: string;
};
