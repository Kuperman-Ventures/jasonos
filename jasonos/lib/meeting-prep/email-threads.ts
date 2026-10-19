export interface ParticipantMailMessage {
  from: string;
  to: string;
  cc: string;
  date: string;
  text: string;
}

export interface ParticipantMailThread {
  id: string;
  subject: string | null;
  participants: string[];
  messages: ParticipantMailMessage[];
}

export interface ParticipantSearch {
  addresses: string[];
  domains: string[];
  since: string;
}
