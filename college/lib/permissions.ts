/** Household role permissions for Kyle College. */

import type { MemberRole } from "@/lib/auth";

export type RoleMember = {
  id: string;
  role: MemberRole | string;
};

export const HOUSEHOLD_ROLES: { id: MemberRole; label: string; blurb: string }[] = [
  {
    id: "super_admin",
    label: "Admin",
    blurb: "Full household access and setup.",
  },
  {
    id: "parent",
    label: "Parent",
    blurb: "Can view and edit shared work; cannot advance list stages or edit the student journal.",
  },
  {
    id: "student",
    label: "Student",
    blurb: "Can advance college list stages and edit the activities journal.",
  },
];

export function roleLabel(role: string): string {
  if (role === "super_admin") return "Admin";
  if (role === "parent") return "Parent";
  if (role === "student") return "Student";
  if (role === "sibling") return "Sibling";
  if (role === "guest") return "Guest";
  return role.replace(/_/g, " ");
}

export function isStudentRole(role: string): boolean {
  return role === "student";
}

export function isParentRole(role: string): boolean {
  return role === "parent";
}

export function isAdminRole(role: string): boolean {
  return role === "super_admin";
}

/**
 * Student role advances Exploration → Consideration → Applications.
 * Local seed mode (no real login) stays unlocked so the funnel is testable.
 */
export function canAdvanceListPhase(member: RoleMember): boolean {
  if (member.id === "local") return true;
  return isStudentRole(member.role);
}

/** Student role owns the activities journal; everyone else can view. */
export function canEditActivitiesJournal(member: RoleMember): boolean {
  if (member.id === "local") return true;
  return isStudentRole(member.role);
}
