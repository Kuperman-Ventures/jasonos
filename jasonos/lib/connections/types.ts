/** Connections Register types. Shared by the Settings page and the JasonOS MCP. */

export const GRANT_STATUSES = [
  "no_use_found",
  "unverified",
  "in_use",
  "turned_off",
  "revoked",
] as const;

export type GrantStatus = (typeof GRANT_STATUSES)[number];

export const STATUS_LABEL: Record<GrantStatus, string> = {
  no_use_found: "No use found",
  unverified: "Unverified",
  in_use: "In use",
  turned_off: "Turned off",
  revoked: "Revoked",
};

export const STATUS_HINT: Record<GrantStatus, string> = {
  no_use_found: "Candidate to revoke",
  unverified: "Found, use not yet confirmed",
  in_use: "Something named uses it",
  turned_off: "Exists but not running",
  revoked: "Access removed",
};

export const COVERAGE_STATES = ["Done", "Partial", "Not checked"] as const;

export type CoverageState = (typeof COVERAGE_STATES)[number];

/** Who made a change. The Settings page writes as "jasonos"; MCP writes as "claude". */
export type Actor = "jasonos" | "claude";

export interface ConnectionGrant {
  id: string;
  identity: string;
  hub: string;
  target: string;
  access: string;
  used_by: string;
  status: GrantStatus;
  evidence: string;
  check_at: string;
  verified_on: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface ManageLink {
  label: string;
  url?: string | null;
}

export interface NodeItem {
  name: string;
  used: boolean;
  note?: string | null;
}

export interface ConnectionNode {
  name: string;
  about: string;
  manage: ManageLink[];
  items: NodeItem[];
  items_label: string | null;
  updated_at: string;
  updated_by: string;
}

export interface CoverageRow {
  id: string;
  source: string;
  state: CoverageState;
  note: string;
  sort_order: number;
  updated_at: string;
  updated_by: string;
}

export interface ConnectionEvent {
  id: string;
  grant_id: string;
  action: "created" | "updated" | "deleted";
  changes: Record<string, unknown>;
  actor: string;
  created_at: string;
}

export interface ConnectionsRegister {
  grants: ConnectionGrant[];
  nodes: ConnectionNode[];
  coverage: CoverageRow[];
  generated_at: string;
}
