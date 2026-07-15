// JasonOS object model — TypeScript mirror of supabase/migrations/0001
// Keep in lockstep with the SQL schema.

export type Track = "venture" | "advisors" | "job_search" | "personal";

export const TRACKS: Track[] = ["venture", "advisors", "job_search", "personal"];

export const TRACK_META: Record<
  Track,
  { label: string; short: string; accent: string; tint: string; ring: string }
> = {
  venture: {
    label: "Kuperman Ventures",
    short: "Ventures",
    accent: "text-emerald-400",
    tint: "bg-emerald-400/10 border-emerald-400/20",
    ring: "ring-emerald-400/30",
  },
  advisors: {
    label: "Kuperman Advisors",
    short: "Advisors",
    accent: "text-sky-400",
    tint: "bg-sky-400/10 border-sky-400/20",
    ring: "ring-sky-400/30",
  },
  job_search: {
    label: "Job Search",
    short: "Job Search",
    accent: "text-violet-400",
    tint: "bg-violet-400/10 border-violet-400/20",
    ring: "ring-violet-400/30",
  },
  personal: {
    label: "Personal",
    short: "Personal",
    accent: "text-amber-400",
    tint: "bg-amber-400/10 border-amber-400/20",
    ring: "ring-amber-400/30",
  },
};

export type CardState =
  | "open"
  | "actioned"
  | "dismissed"
  | "snoozed"
  | "archived";

export type TodoState = "open" | "done";

export type ProjectStatus =
  | "active"
  | "paused"
  | "completed"
  | "abandoned";

export type AlertCategory = "error" | "reply" | "opportunity" | "deadline";
export type AlertSeverity = "info" | "warn" | "critical";

export type Verb =
  | "send"
  | "edit_send"
  | "draft"
  | "snooze"
  | "add_todo"
  | "schedule"
  | "prioritize"
  | "log_to_hubspot"
  | "mark_won"
  | "mark_lost"
  | "forward_to"
  | "add_to_memory"
  | "generate_doc"
  | "open_in_cursor"
  | "dismiss"
  | "tell_claude"
  | "message"
  | "reconnect";

// Body is intentionally permissive — `jasonos.cards.body` is jsonb on the DB
// side, and different modules write different shapes (message draft, ranker
// pick metadata, BNA evidence, etc.). The well-known fields below are kept
// strongly typed; arbitrary extras flow through the index signature.
// Consumers narrow per `module` when they need module-specific keys.
export interface ActionCardBody {
  draft?: string;
  context?: string;
  links?: { label: string; href: string }[];
  [key: string]: unknown;
}

export interface ActionCard {
  id: string;
  track: Track;
  module: string;
  object_type: string;
  title: string;
  subtitle?: string;
  body?: ActionCardBody;
  linked_object_ids?: Record<string, string | undefined>;
  priority_score?: number;
  state: CardState;
  vip: boolean;
  why_now?: string;
  verbs: Verb[];
  snoozed_until?: string;
  pinned_at?: string | null;
  created_at: string;
  updated_at: string;
  actioned_at?: string;
}

export interface ToDo {
  id: string;
  track: Track;
  project_id?: string;
  title: string;
  notes?: string;
  tags: string[];
  due_date?: string;
  source_card_id?: string;
  source_type?: "manual" | "auto_extracted" | "plan_step" | "card_spawned";
  state: TodoState;
  completion_note?: string;
  external_push?: { things_id?: string; hubspot_task_id?: string };
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Project {
  id: string;
  track: Track;
  name: string;
  goal_statement?: string;
  success_criteria: string[];
  status: ProjectStatus;
  source?: "user_defined" | "claude_decomposed" | "meeting_extracted";
  conversation_id?: string;
  target_date?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

/**
 * Six-bucket role classification, lifted onto contacts in migration 0013.
 * See lib/outreach/types.ts for label/helper exports.
 */
export type RelationshipType =
  | "recruiter"
  | "hiring_manager"
  | "operator_peer"
  | "mentor_advisor"
  | "prospect"
  | "personal";

/**
 * How often the user wants to communicate with this contact. Stored as text on
 * jasonos.contacts (migration 0013). `none` means "no cadence — schedule manually".
 */
export type CadenceInterval =
  | "weekly"
  | "biweekly"
  | "triweekly"
  | "monthly"
  | "quarterly"
  | "none";

export interface Contact {
  id: string;
  name: string;
  emails: string[];
  linkedin_url?: string;
  title?: string;
  company_id?: string;
  company?: Pick<Company, "id" | "name"> | null;
  vip: boolean;
  tracks: Track[];
  tags: string[]; // see migration 0005 — supports 'alumni:tbwa', 'conference:cannes-2024', etc.
  source_ids: { encore_os?: string; hubspot?: string; leaddelta?: string };
  last_touch_date?: string;
  last_touch_channel?: string;
  objective_result?: "yes" | "no" | "neutral";
  notes?: string;
  /** Six-bucket role: who this person is to me. See migration 0013. */
  relationship_type?: RelationshipType | null;
  /** How often to touch this person. `none` = no cadence set. See migration 0013. */
  cadence_interval?: CadenceInterval | null;
  /** ISO date (YYYY-MM-DD). When the next touch is due. See migration 0013. */
  next_touch_date?: string | null;
  /** Stage in the touch arc (initial → followup_1 → followup_2 → ongoing). Migration 0015. */
  cadence_stage?: "initial" | "followup_1" | "followup_2" | "ongoing" | null;
}

export interface ContactScore {
  id: string;
  contact_id: string;
  recency: number; // 1-5
  seniority: number; // 1-5
  fit: number; // 1-5
  scored_by: "user" | "ai";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  vip: boolean;
  hubspot_id?: string;
  tracks: Track[];
  tags: string[];
}

export interface Disposition {
  id: string;
  card_id?: string;
  todo_id?: string;
  contact_id?: string;
  action:
    | "sent"
    | "edited_sent"
    | "dismissed"
    | "snoozed"
    | "completed"
    | "deferred"
    | "reassigned";
  reason_code?: string;
  reason_note?: string;
  timestamp: string;
}

export interface Alert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  source?: string;
  title: string;
  body?: string;
  linked_card_id?: string;
  state: "open" | "acknowledged" | "resolved";
  created_at: string;
  resolved_at?: string;
}

// ----- Monitoring tiles ---------------------------------------------------

export type TileCadence = "real-time" | "daily" | "weekly";

export interface MonitoringTile {
  id: string;
  track: Track;
  group:
    | "sites_marketing"
    | "outbound_email"
    | "pipeline_revenue"
    | "refactor_sprint_engagements"
    | "venture_health"
    | "job_search"
    | "personal_ops";
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  series: number[];
  cadence: TileCadence;
  refreshedAt: string;
  source: string;
  pinned?: boolean;
  alert?: { tone: "warn" | "critical"; message: string; verb?: string };
}

// ----- Best Next Action ---------------------------------------------------

export interface BestNextActionItem {
  card_id: string;
  rank: number;
  why_now: string;
  suggested_time_block?: string;
  pinned?: boolean;
}
