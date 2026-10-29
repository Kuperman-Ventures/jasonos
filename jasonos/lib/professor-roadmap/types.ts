export const PROFESSOR_ROADMAP_PATH = "/projects/professor-roadmap";

export const QUESTION_STATUSES = ["open", "researched", "confirmed"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const DECISION_STATUSES = ["open", "proposed", "decided"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const NEXT_STEP_STATUSES = ["open", "done", "skipped"] as const;
export type NextStepStatus = (typeof NEXT_STEP_STATUSES)[number];

export const ROLE_KINDS = [
  "chair",
  "faculty",
  "practitioner",
  "admin",
  "other",
] as const;
export type RoleKind = (typeof ROLE_KINDS)[number];

export type ResearchSource = {
  title: string | null;
  url: string;
};

export type DecisionOption = {
  name: string;
  pros: string;
  cons: string;
};

export type ProfessorSchoolPerson = {
  id: string;
  schoolId: string;
  name: string;
  title: string;
  roleKind: RoleKind;
  profileUrl: string;
  contactId: string | null;
  createdAt: string;
};

export type ProfessorSchoolPosting = {
  id: string;
  schoolId: string;
  title: string;
  url: string;
  department: string;
  degreeRequired: string;
  seenAt: string;
};

export type ProfessorSchool = {
  id: string;
  slug: string;
  name: string;
  businessSchool: string;
  department: string;
  website: string;
  facultyUrl: string;
  jobsUrl: string;
  isPrimary: boolean;
  briefMd: string;
  briefSources: ResearchSource[];
  briefRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
  people: ProfessorSchoolPerson[];
  postings: ProfessorSchoolPosting[];
};

export type ProfessorQuestion = {
  id: string;
  schoolId: string | null;
  sortOrder: number;
  question: string;
  whyItMatters: string;
  status: QuestionStatus;
  findingMd: string;
  findingSources: ResearchSource[];
  researchedAt: string | null;
  confirmedBy: string;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfessorDecision = {
  id: string;
  sortOrder: number;
  title: string;
  whyItMatters: string;
  options: DecisionOption[];
  dependsOnQuestionIds: string[];
  proposedOption: string;
  proposedRationaleMd: string;
  proposedAt: string | null;
  decidedOption: string;
  decidedNote: string;
  decidedAt: string | null;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProfessorNextStep = {
  id: string;
  schoolId: string | null;
  questionId: string | null;
  decisionId: string | null;
  sortOrder: number;
  text: string;
  rationale: string;
  status: NextStepStatus;
  todoId: string | null;
  generated: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ProfessorRoadmap = {
  schools: ProfessorSchool[];
  questions: ProfessorQuestion[];
  decisions: ProfessorDecision[];
  nextSteps: ProfessorNextStep[];
};

export type SchoolWrite = {
  slug: string;
  name: string;
  businessSchool?: string;
  department?: string;
  website?: string;
  facultyUrl?: string;
  jobsUrl?: string;
  isPrimary?: boolean;
};

export type QuestionWrite = {
  schoolId?: string | null;
  sortOrder?: number;
  question: string;
  whyItMatters?: string;
};

export type NextStepWrite = {
  schoolId?: string | null;
  questionId?: string | null;
  decisionId?: string | null;
  sortOrder?: number;
  text: string;
  rationale?: string;
  generated?: boolean;
};

export type PersonUpsert = {
  name: string;
  title?: string;
  roleKind?: RoleKind;
  profileUrl?: string;
};

export type PostingUpsert = {
  title: string;
  url: string;
  department?: string;
  degreeRequired?: string;
};

export function inferRoleKind(title: string): RoleKind {
  const t = title.toLowerCase();
  if (/\bchair\b/.test(t)) return "chair";
  if (
    /\binstructor\b/.test(t) ||
    /\blecturer\b/.test(t) ||
    /\bprofessor of practice\b/.test(t) ||
    /\badjunct\b/.test(t) ||
    /\bexecutive in residence\b/.test(t)
  ) {
    return "practitioner";
  }
  if (
    (/\bdean\b/.test(t) || /\bcoordinator\b/.test(t) || /\bdirector\b/.test(t)) &&
    !/\bprofessor\b/.test(t)
  ) {
    return "admin";
  }
  return "faculty";
}
