/** Creator-only admin helpers for The Track (Jason / super_admin). */

import {
  COMMON_APP_GRID_CYCLE_START,
  KYLE_APPLICATION_CYCLE_START,
} from "@/lib/common-app-grid";
import { LIST_PHASES, type ListPhaseId } from "@/lib/list-phases";
import { roleLabel } from "@/lib/permissions";
import type { School } from "@/lib/types";

export type AdminMemberRow = {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
  roleLabel: string;
  uiVisible: boolean;
  hasAuth: boolean;
  lastSignInAt: string | null;
  avatarUrl: string | null;
};

export type AdminPulse = {
  siteUrl: string;
  supabase: boolean;
  auth: boolean;
  aiGateway: boolean;
  aiModel: string;
  scorecard: "live" | "demo";
  schoolCount: number;
  archivedCount: number;
  missingWebsite: number;
  missingPrograms: number;
  needsCommonApp: number;
  lastSchoolActivityAt: string | null;
  lastSchoolActivitySummary: string | null;
};

export type AdminPhaseCount = {
  id: ListPhaseId;
  label: string;
  count: number;
  target: number;
  rangeLabel: string;
};

export type AdminHygiene = {
  blankInterest: { id: string; name: string }[];
  noTier: { id: string; name: string }[];
  missingWebsite: { id: string; name: string }[];
  missingPrograms: { id: string; name: string }[];
  seniorCycleDeadlines: { id: string; name: string; title: string; dueDate: string }[];
  archivedCount: number;
  phaseCounts: AdminPhaseCount[];
};

export function scorecardKeyMode(apiKey = process.env.COLLEGE_SCORECARD_API_KEY): "live" | "demo" {
  return apiKey?.trim() ? "live" : "demo";
}

export function adminSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv =
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    env.VERCEL_URL?.trim() ||
    "";
  if (fromEnv) {
    return fromEnv.startsWith("http") ? fromEnv.replace(/\/$/, "") : `https://${fromEnv.replace(/\/$/, "")}`;
  }
  return "https://kyle-college.vercel.app";
}

function missingProgramFields(school: School): boolean {
  return !(
    school.mechanicalEngineering.trim() &&
    school.materials.trim() &&
    school.aerospaceEngineering.trim()
  );
}

/** Deadlines still on the seniors' Common App cycle (before Kyle's Aug start). */
export function isSeniorCycleDeadline(dueDate: string | null | undefined): boolean {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false;
  const kyleCycleStart = `${KYLE_APPLICATION_CYCLE_START}-08-01`;
  const gridStart = `${COMMON_APP_GRID_CYCLE_START}-08-01`;
  return dueDate >= gridStart && dueDate < kyleCycleStart;
}

export function buildAdminHygiene(schools: School[]): AdminHygiene {
  const live = schools.filter((school) => !school.archived);
  const blankInterest = live
    .filter((school) => !school.interestLevel)
    .map((school) => ({ id: school.id, name: school.name }));
  const noTier = live
    .filter((school) => !school.selectivityTier)
    .map((school) => ({ id: school.id, name: school.name }));
  const missingWebsite = live
    .filter((school) => !school.website.trim())
    .map((school) => ({ id: school.id, name: school.name }));
  const missingPrograms = live
    .filter(missingProgramFields)
    .map((school) => ({ id: school.id, name: school.name }));

  const seniorCycleDeadlines: AdminHygiene["seniorCycleDeadlines"] = [];
  for (const school of live) {
    for (const deadline of school.deadlines) {
      if (deadline.completed) continue;
      if (!isSeniorCycleDeadline(deadline.dueDate)) continue;
      seniorCycleDeadlines.push({
        id: school.id,
        name: school.name,
        title: deadline.title,
        dueDate: deadline.dueDate!,
      });
    }
  }
  seniorCycleDeadlines.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));

  const phaseCounts: AdminPhaseCount[] = LIST_PHASES.map((phase) => ({
    id: phase.id,
    label: phase.label,
    count: live.filter((school) => school.listPhase === phase.id).length,
    target: phase.target,
    rangeLabel: phase.rangeLabel,
  }));

  return {
    blankInterest,
    noTier,
    missingWebsite,
    missingPrograms,
    seniorCycleDeadlines,
    archivedCount: schools.filter((school) => school.archived).length,
    phaseCounts,
  };
}

export function buildAdminPulse(input: {
  schools: School[];
  needsCommonApp: number;
  lastSchoolActivityAt: string | null;
  lastSchoolActivitySummary: string | null;
  siteUrl: string;
  supabase: boolean;
  auth: boolean;
  aiGateway: boolean;
  aiModel: string;
  scorecard: "live" | "demo";
}): AdminPulse {
  const live = input.schools.filter((school) => !school.archived);
  return {
    siteUrl: input.siteUrl,
    supabase: input.supabase,
    auth: input.auth,
    aiGateway: input.aiGateway,
    aiModel: input.aiModel,
    scorecard: input.scorecard,
    schoolCount: live.length,
    archivedCount: input.schools.length - live.length,
    missingWebsite: live.filter((school) => !school.website.trim()).length,
    missingPrograms: live.filter(missingProgramFields).length,
    needsCommonApp: input.needsCommonApp,
    lastSchoolActivityAt: input.lastSchoolActivityAt,
    lastSchoolActivitySummary: input.lastSchoolActivitySummary,
  };
}

export function mapAdminMember(row: {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
  uiVisible: boolean;
  authUserId: string | null;
  avatarUrl: string | null;
  lastSignInAt?: string | null;
}): AdminMemberRow {
  return {
    id: row.id,
    displayName: row.displayName,
    email: row.email,
    role: row.role,
    roleLabel: roleLabel(row.role),
    uiVisible: row.uiVisible,
    hasAuth: Boolean(row.authUserId),
    lastSignInAt: row.lastSignInAt ?? null,
    avatarUrl: row.avatarUrl,
  };
}

export function loginUrlForSite(siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, "")}/login`;
}

export function formatAdminWhen(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
