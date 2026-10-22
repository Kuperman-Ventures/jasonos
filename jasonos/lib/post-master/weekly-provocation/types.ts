export type WeeklyProvocationSourceName = "gmail" | "outlook";

export type WeeklyProvocationStatus =
  | "detected"
  | "researching"
  | "ready"
  | "failed";

export type ProvocationSource = {
  title: string | null;
  url: string;
};

export type ProvocationQuestion = {
  id: string;
  prompt: string;
  background: string;
  sources: ProvocationSource[];
};

/** What the Post Master page and refresh action show. Raw email body stays on the server. */
export type WeeklyProvocationListItem = {
  id: string;
  source: WeeklyProvocationSourceName;
  fromName: string;
  fromEmail: string;
  subject: string;
  receivedAt: string | null;
  threadUrl: string | null;
  tldr: string | null;
  questions: ProvocationQuestion[];
  status: WeeklyProvocationStatus;
  error: string | null;
  updatedAt: string;
};

export type ProvocationCandidate = {
  source: WeeklyProvocationSourceName;
  accountEmail: string;
  externalId: string;
  threadId: string | null;
  rfc822MessageId: string | null;
  fromName: string;
  fromEmail: string;
  subject: string;
  receivedAt: string | null;
  threadUrl: string | null;
  bodyText: string;
};
