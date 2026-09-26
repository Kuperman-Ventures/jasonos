/** Derive a comparable requirements profile from school record fields. */

import type { School } from "@/lib/types";

export type RequirementState = "req" | "mod" | "no" | "unk";

export type RequirementKey =
  | "application"
  | "essay"
  | "supplements"
  | "tests"
  | "teacherRecs"
  | "counselorRec"
  | "interview";

export type RequirementProfileItem = {
  key: RequirementKey;
  label: string;
  state: RequirementState;
  note: string;
};

export type KitCopy = {
  title: string;
  detail: string;
};

export type SchoolRequirementsView = {
  testPolicy: string;
  middle50: string;
  satRange: [number, number] | null;
  admissionsContext: string;
  platform: string;
  profile: RequirementProfileItem[];
  kit: Record<RequirementKey, KitCopy>;
};

export const REQUIREMENT_CATALOG: { key: RequirementKey; label: string }[] = [
  { key: "application", label: "Application" },
  { key: "essay", label: "Personal essay" },
  { key: "supplements", label: "Supplemental essays" },
  { key: "tests", label: "Test scores" },
  { key: "teacherRecs", label: "Teacher recs" },
  { key: "counselorRec", label: "Counselor rec" },
  { key: "interview", label: "Interview" },
];

export const REQUIREMENT_STATE_LABEL: Record<RequirementState, string> = {
  req: "Required",
  mod: "Modified",
  no: "Not required",
  unk: "Not listed",
};

export const REQUIREMENT_STATUS_LABEL = ["Not started", "In progress", "Done"] as const;

export const SAT_SCALE: [number, number] = [1200, 1600];

const UNK_NOTE = "Not in our data";

function blank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

function testPolicyText(school: School): string {
  const record = school.testPolicy.trim();
  if (record) return record;
  const family = school.familyTestPolicy.trim();
  if (family) return family;
  const sat = school.satContext.trim();
  if (/test[- ]?(free|blind)/i.test(sat)) return "Test-free";
  return "";
}

export function classifyTestPolicy(policy: string): { state: RequirementState; note: string } {
  const text = policy.trim();
  if (!text) return { state: "unk", note: UNK_NOTE };
  const lower = text.toLowerCase();
  // Optional / considered-but-not-required before bare "not required" (test-blind).
  if (
    /optional|considered but not required|tests considered|recommended(?!\s+required)/.test(lower)
  ) {
    return { state: "mod", note: text };
  }
  if (
    /test[- ]?(free|blind)|neither required|not (required|accepted|considered)|do not consider/.test(
      lower,
    )
  ) {
    return { state: "no", note: text };
  }
  if (/required|must (submit|send)|mandatory/.test(lower)) {
    return { state: "req", note: text };
  }
  return { state: "mod", note: text };
}

function parseEssayFields(requiredEssays: string): {
  essay: { state: RequirementState; note: string };
  supplements: { state: RequirementState; note: string };
} {
  const text = requiredEssays.trim();
  if (!text) {
    return {
      essay: { state: "unk", note: UNK_NOTE },
      supplements: { state: "unk", note: UNK_NOTE },
    };
  }
  const lower = text.toLowerCase();
  const hasPersonal = /personal essay|common app essay|main essay/.test(lower);
  const personalNotRequired = /personal essay (?:is )?not required|common app personal essay not required/.test(
    lower,
  );
  const personalRequired =
    /personal essay required|common app personal essay required|main essay required/.test(lower);

  let essay: { state: RequirementState; note: string };
  if (personalNotRequired) {
    essay = { state: "no", note: "Not required" };
  } else if (personalRequired || (hasPersonal && /required/.test(lower))) {
    essay = { state: "req", note: "Required" };
  } else if (hasPersonal) {
    essay = { state: "mod", note: text.slice(0, 80) };
  } else if (/essay/.test(lower)) {
    essay = { state: "req", note: "Required" };
  } else {
    essay = { state: "unk", note: UNK_NOTE };
  }

  const hasSupplements =
    /supplement|why us|short answer|additional essay|writing supplement/.test(lower);
  const hasPortfolio = /portfolio/.test(lower);
  let supplements: { state: RequirementState; note: string };
  if (hasSupplements || hasPortfolio) {
    const note = hasPortfolio && !hasSupplements ? "Portfolio / major-specific" : "Listed in essays";
    supplements = { state: hasPortfolio && !hasSupplements ? "mod" : "req", note };
  } else if (essay.state !== "unk") {
    supplements = { state: "unk", note: UNK_NOTE };
  } else {
    supplements = { state: "unk", note: UNK_NOTE };
  }

  return { essay, supplements };
}

function parseTeacherRecCount(teacherRecs: string): number | null {
  const text = teacherRecs.trim();
  if (!text) return null;
  const match = text.match(/(\d+)\s*teacher/i);
  if (match) return Number(match[1]);
  if (/no teacher|0 teacher|teacher recommendations?:?\s*none|not required.*teacher/i.test(text)) {
    return 0;
  }
  if (/teacher recommendation/i.test(text)) return 1;
  return null;
}

function parseCounselorRec(teacherRecs: string): { state: RequirementState; note: string } {
  const text = teacherRecs.trim();
  if (!text) return { state: "unk", note: UNK_NOTE };
  const lower = text.toLowerCase();
  if (/counselor recommendation (?:is )?not required|counselor recommendation not required/.test(lower)) {
    return { state: "no", note: "Not required" };
  }
  if (/counselor recommendation required|counselor recommendation/.test(lower)) {
    return { state: "req", note: "Required" };
  }
  return { state: "unk", note: UNK_NOTE };
}

/** Parse a composite SAT middle-50 band from middle50 / satContext text. */
export function parseSatRange(...sources: string[]): [number, number] | null {
  for (const source of sources) {
    const text = source.trim();
    if (!text) continue;

    const composite = text.match(/(?:^|[^\d])((?:1[2-6]\d{2}))\s*[–\-~—]+\s*((?:1[2-6]\d{2}))/);
    if (composite) {
      const lo = Number(composite[1]);
      const hi = Number(composite[2]);
      if (lo >= 1200 && hi <= 1600 && lo <= hi) return [lo, hi];
    }

    const reading = text.match(/reading\s+(\d{3,4})\s*[-–—]\s*(\d{3,4})/i);
    const math = text.match(/math\s+(\d{3,4})\s*[-–—]\s*(\d{3,4})/i);
    if (reading && math) {
      const lo = Number(reading[1]) + Number(math[1]);
      const hi = Number(reading[2]) + Number(math[2]);
      if (lo >= 400 && hi <= 1600 && lo <= hi) {
        return [Math.max(1200, lo), Math.min(1600, hi)];
      }
    }
  }
  return null;
}

function kitFor(
  school: School,
  platform: string,
  testPolicy: string,
  teacherCount: number | null,
  essayNote: string,
  supplementsNote: string,
): Record<RequirementKey, KitCopy> {
  const name = school.name;
  return {
    application: {
      title: platform ? `${platform} application` : "Application",
      detail: platform ? `${name} applies through ${platform}.` : "",
    },
    essay: {
      title: "Personal essay",
      detail: essayNote && essayNote !== UNK_NOTE ? essayNote : "",
    },
    supplements: {
      title: "Supplemental essays",
      detail: supplementsNote && supplementsNote !== UNK_NOTE ? supplementsNote : "",
    },
    tests: {
      title: /act/i.test(testPolicy) && !/sat/i.test(testPolicy) ? "ACT scores" : "SAT scores",
      detail: testPolicy
        ? `${testPolicy}${/required/i.test(testPolicy) ? ". Send official scores." : ""}`
        : "",
    },
    teacherRecs: {
      title:
        teacherCount == null
          ? "Teacher recommendations"
          : `Teacher recommendations (${teacherCount})`,
      detail: "",
    },
    counselorRec: {
      title: "Counselor recommendation",
      detail: "",
    },
    interview: {
      title: "Interview",
      detail: "",
    },
  };
}

export function buildSchoolRequirements(school: School): SchoolRequirementsView {
  const platform = school.applicationPlatform.trim();
  const testPolicy = testPolicyText(school);
  const middle50 = school.middle50.trim() || school.satContext.trim();
  const admissionsContext = school.admissionsContext.trim() || "Not entered";
  const tests = classifyTestPolicy(testPolicy);
  const essays = parseEssayFields(school.requiredEssays);
  const teacherCount = parseTeacherRecCount(school.teacherRecs);
  const counselor = parseCounselorRec(school.teacherRecs);

  let teacherState: RequirementState;
  let teacherNote: string;
  if (teacherCount == null && blank(school.teacherRecs)) {
    teacherState = "unk";
    teacherNote = UNK_NOTE;
  } else if (teacherCount === 0) {
    teacherState = "no";
    teacherNote = "0 needed";
  } else if (teacherCount != null && teacherCount > 0) {
    teacherState = "req";
    teacherNote = `${teacherCount} needed`;
  } else {
    teacherState = "unk";
    teacherNote = UNK_NOTE;
  }

  const application: RequirementProfileItem = {
    key: "application",
    label: "Application",
    state: platform ? "req" : "unk",
    note: platform || UNK_NOTE,
  };

  const profile: RequirementProfileItem[] = [
    application,
    { key: "essay", label: "Personal essay", state: essays.essay.state, note: essays.essay.note },
    {
      key: "supplements",
      label: "Supplemental essays",
      state: essays.supplements.state,
      note: essays.supplements.note,
    },
    { key: "tests", label: "Test scores", state: tests.state, note: tests.note },
    { key: "teacherRecs", label: "Teacher recs", state: teacherState, note: teacherNote },
    {
      key: "counselorRec",
      label: "Counselor rec",
      state: counselor.state,
      note: counselor.note,
    },
    { key: "interview", label: "Interview", state: "unk", note: UNK_NOTE },
  ];

  return {
    testPolicy: testPolicy || "Not listed",
    middle50: middle50 || "Not listed",
    satRange: parseSatRange(school.middle50, school.satContext),
    admissionsContext,
    platform: platform || "Not listed",
    profile,
    kit: kitFor(
      school,
      platform,
      testPolicy,
      teacherCount,
      essays.essay.note,
      essays.supplements.note,
    ),
  };
}

export function toSubmitItems(profile: RequirementProfileItem[]): RequirementProfileItem[] {
  return profile.filter((item) => item.state === "req" || item.state === "mod");
}

export function recommendationCount(profile: RequirementProfileItem[]): number {
  return profile.filter(
    (item) =>
      (item.key === "teacherRecs" || item.key === "counselorRec") &&
      item.state !== "no" &&
      item.state !== "unk",
  ).length;
}

export function satPosition(score: number, scale: [number, number] = SAT_SCALE): number {
  const [lo, hi] = scale;
  if (hi <= lo) return 0;
  return Math.min(100, Math.max(0, ((score - lo) / (hi - lo)) * 100));
}

export function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/)[0];
  return part || "Student";
}
