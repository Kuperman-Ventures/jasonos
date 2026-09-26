import {
  interestLabel,
  statusLabel,
  tierLabel,
  trackLabel,
  visitLabel,
  type School,
} from "./types";
import { LIST_PHASES } from "./list-phases";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function phaseLabel(id: string): string {
  return LIST_PHASES.find((phase) => phase.id === id)?.label ?? id;
}

/** Flat spreadsheet rows for Google Sheets / Excel. */
export function schoolsSpreadsheetRows(schools: School[]): string[][] {
  const header = [
    "School",
    "Archived",
    "List phase",
    "Location",
    "Campus size",
    "Selectivity",
    "Interest",
    "Visit",
    "Visit date",
    "Visit notes",
    "Application status",
    "Admission track",
    "Test policy",
    "SAT",
    "Mechanical engineering",
    "Materials",
    "Materials offering",
    "Aerospace engineering",
    "Aerospace program",
    "Website",
    "Cost of attendance",
    "Net price",
    "Merit aid notes",
    "Notes",
    "Undergrad enrollment",
  ];

  const rows = schools.map((school) => [
    school.name,
    school.archived ? "Yes" : "No",
    phaseLabel(school.listPhase),
    school.location,
    school.campusSize,
    tierLabel(school.selectivityTier),
    interestLabel(school.interestLevel),
    visitLabel(school.visitStatus),
    school.visitDate ?? "",
    school.visitNotes,
    statusLabel(school.applicationStatus),
    trackLabel(school.admissionTrack),
    school.testPolicy || school.familyTestPolicy,
    school.satContext,
    school.mechanicalEngineering,
    school.materials,
    school.materialsOffering,
    school.aerospaceEngineering,
    school.aerospaceProgram,
    school.website,
    school.costOfAttendance,
    school.netPriceEstimate,
    school.meritAidNotes,
    school.notes,
    school.undergradEnrollment == null ? "" : String(school.undergradEnrollment),
  ]);

  return [header, ...rows];
}

export function schoolsToCsv(schools: School[]): string {
  return schoolsSpreadsheetRows(schools)
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\n");
}

export function downloadSchoolsCsv(schools: School[], filename = "kyle-college-list.csv"): void {
  const csv = schoolsToCsv(schools);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
