"use server";

import { revalidatePath } from "next/cache";
import {
  proposeDecision as aiProposeDecision,
  proposeNextSteps,
  researchQuestion,
  researchSchoolBrief,
} from "@/lib/ai/professor-research";
import { jasonosDb } from "@/lib/mcp/db";
import {
  addNextStep,
  addQuestion,
  addSchool,
  confirmQuestion,
  decideDecision,
  getDecisionById,
  getNextStepById,
  getPersonById,
  getProfessorRoadmap,
  getQuestionById,
  getSchoolById,
  proposeDecision as storeProposeDecision,
  reopenDecision,
  replaceGeneratedNextSteps,
  saveQuestionFinding,
  saveSchoolBrief,
  setNextStepStatus,
  setNextStepTodoId,
  setPersonContactId,
  setQuestionStatus,
  updateQuestion,
} from "@/lib/professor-roadmap/store";
import { PROFESSOR_ROADMAP_PATH } from "@/lib/professor-roadmap/types";
import { createContactUnclassified } from "@/lib/server-actions/contacts";

type ActionResult<T = Record<string, never>> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidate() {
  revalidatePath(PROFESSOR_ROADMAP_PATH);
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    console.error("[professor-roadmap.action]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runQuestionResearch(
  questionId: string
): Promise<ActionResult<{ questionId: string }>> {
  return run(async () => {
    const question = await getQuestionById(questionId);
    if (!question) throw new Error("Question not found.");

    const roadmap = await getProfessorRoadmap();
    const school =
      (question.schoolId
        ? roadmap.schools.find((s) => s.id === question.schoolId)
        : null) ??
      roadmap.schools.find((s) => s.isPrimary) ??
      roadmap.schools[0];
    if (!school) throw new Error("No school on the roadmap.");

    const result = await researchQuestion({
      question: question.question,
      whyItMatters: question.whyItMatters,
      school: {
        name: school.name,
        businessSchool: school.businessSchool,
        department: school.department,
        website: school.website,
      },
    });

    await saveQuestionFinding(questionId, result.text, result.sources);
    revalidate();
    return { questionId };
  });
}

export async function markQuestionConfirmed(
  questionId: string,
  confirmedBy: string
): Promise<ActionResult<{ questionId: string }>> {
  return run(async () => {
    await confirmQuestion(questionId, confirmedBy);
    revalidate();
    return { questionId };
  });
}

export async function reopenQuestion(
  questionId: string
): Promise<ActionResult<{ questionId: string }>> {
  return run(async () => {
    await setQuestionStatus(questionId, "open");
    await updateQuestion(questionId, {
      confirmedBy: "",
      confirmedAt: null,
    });
    revalidate();
    return { questionId };
  });
}

export async function refreshSchoolBrief(
  schoolId: string
): Promise<ActionResult<{ schoolId: string }>> {
  return run(async () => {
    const school = await getSchoolById(schoolId);
    if (!school) throw new Error("School not found.");

    const result = await researchSchoolBrief({
      name: school.name,
      businessSchool: school.businessSchool,
      department: school.department,
      facultyUrl: school.facultyUrl,
      jobsUrl: school.jobsUrl,
    });

    await saveSchoolBrief(
      schoolId,
      result.brief.text,
      result.brief.sources,
      result.people.map((p) => ({
        name: p.name,
        title: p.title,
        roleKind: p.role_kind,
        profileUrl: p.profile_url,
      })),
      result.postings.map((p) => ({
        title: p.title,
        url: p.url,
        department: p.department,
        degreeRequired: p.degree_required,
      }))
    );
    revalidate();
    return { schoolId };
  });
}

export async function addSchoolBySlug(input: {
  name: string;
  businessSchool?: string;
  department?: string;
  website?: string;
  facultyUrl?: string;
  jobsUrl?: string;
}): Promise<ActionResult<{ schoolId: string }>> {
  return run(async () => {
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    const school = await addSchool({
      slug,
      name: input.name,
      businessSchool: input.businessSchool,
      department: input.department,
      website: input.website,
      facultyUrl: input.facultyUrl,
      jobsUrl: input.jobsUrl,
    });

    try {
      const result = await researchSchoolBrief({
        name: school.name,
        businessSchool: school.businessSchool,
        department: school.department,
        facultyUrl: school.facultyUrl,
        jobsUrl: school.jobsUrl,
      });
      await saveSchoolBrief(
        school.id,
        result.brief.text,
        result.brief.sources,
        result.people.map((p) => ({
          name: p.name,
          title: p.title,
          roleKind: p.role_kind,
          profileUrl: p.profile_url,
        })),
        result.postings.map((p) => ({
          title: p.title,
          url: p.url,
          department: p.department,
          degreeRequired: p.degree_required,
        }))
      );
    } catch (error) {
      console.error("[professor-roadmap] brief after addSchool failed", error);
    }

    revalidate();
    return { schoolId: school.id };
  });
}

export async function addProfessorQuestion(input: {
  question: string;
  whyItMatters?: string;
  schoolId?: string | null;
}): Promise<ActionResult<{ questionId: string }>> {
  return run(async () => {
    const row = await addQuestion({
      question: input.question,
      whyItMatters: input.whyItMatters,
      schoolId: input.schoolId,
    });
    revalidate();
    return { questionId: row.id };
  });
}

export async function addPersonToContacts(
  personId: string
): Promise<ActionResult<{ contactId: string }>> {
  return run(async () => {
    const person = await getPersonById(personId);
    if (!person) throw new Error("Person not found.");
    if (person.contactId) {
      revalidate();
      return { contactId: person.contactId };
    }

    const school = await getSchoolById(person.schoolId);
    const created = await createContactUnclassified({
      name: person.name,
      title: person.title || null,
      firm: school?.name ?? null,
      linkedin_url: null,
    });
    if (!created.ok) throw new Error(created.error);

    await setPersonContactId(personId, created.contactId);
    revalidate();
    return { contactId: created.contactId };
  });
}

export async function generateNextSteps(): Promise<
  ActionResult<{ count: number }>
> {
  return run(async () => {
    const roadmap = await getProfessorRoadmap();
    const steps = await proposeNextSteps({ roadmap });
    await replaceGeneratedNextSteps(
      steps.map((step) => ({
        text: step.text,
        rationale: step.rationale,
        questionId: step.question_id ?? null,
        decisionId: step.decision_id ?? null,
        schoolId: step.school_id ?? null,
        generated: true,
      }))
    );
    revalidate();
    return { count: steps.length };
  });
}

export async function addHandNextStep(input: {
  text: string;
  rationale?: string;
  questionId?: string | null;
  decisionId?: string | null;
  schoolId?: string | null;
}): Promise<ActionResult<{ stepId: string }>> {
  return run(async () => {
    const step = await addNextStep({
      text: input.text,
      rationale: input.rationale,
      questionId: input.questionId,
      decisionId: input.decisionId,
      schoolId: input.schoolId,
      generated: false,
    });
    revalidate();
    return { stepId: step.id };
  });
}

export async function pushNextStepToTodos(
  stepId: string
): Promise<ActionResult<{ todoId: string }>> {
  return run(async () => {
    const step = await getNextStepById(stepId);
    if (!step) throw new Error("Next step not found.");
    if (step.todoId) {
      revalidate();
      return { todoId: step.todoId };
    }

    const db = jasonosDb();
    const { data, error } = await db
      .from("todos")
      .insert({
        title: step.text.trim().slice(0, 240),
        track: "personal",
        notes: step.rationale?.trim() || null,
        due_date: null,
        state: "open",
        source_type: "professor_roadmap",
        tags: ["professor-roadmap"],
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await setNextStepTodoId(stepId, data.id as string);
    revalidate();
    revalidatePath("/todos");
    return { todoId: data.id as string };
  });
}

export async function setNextStep(
  stepId: string,
  status: "open" | "done" | "skipped"
): Promise<ActionResult<{ stepId: string }>> {
  return run(async () => {
    const step = await setNextStepStatus(stepId, status);
    if (status === "done" && step.todoId) {
      const db = jasonosDb();
      const { error } = await db
        .from("todos")
        .update({
          state: "done",
          completed_at: new Date().toISOString(),
        })
        .eq("id", step.todoId);
      if (error) throw new Error(error.message);
      revalidatePath("/todos");
    }
    revalidate();
    return { stepId };
  });
}

export async function runDecisionProposal(
  decisionId: string
): Promise<ActionResult<{ decisionId: string }>> {
  return run(async () => {
    const decision = await getDecisionById(decisionId);
    if (!decision) throw new Error("Decision not found.");

    const roadmap = await getProfessorRoadmap();
    const deps = decision.dependsOnQuestionIds;
    const related = roadmap.questions.filter((q) => deps.includes(q.id));
    const unfinished = related.filter(
      (q) => q.status !== "researched" && q.status !== "confirmed"
    );
    if (unfinished.length > 0) {
      const nums = unfinished
        .map((q) => q.sortOrder)
        .sort((a, b) => a - b)
        .join(", ");
      throw new Error(`Research questions ${nums} first.`);
    }

    const proposal = await aiProposeDecision({
      decision,
      questions: roadmap.questions,
    });
    await storeProposeDecision(
      decisionId,
      proposal.option,
      proposal.rationale_md
    );
    revalidate();
    return { decisionId };
  });
}

export async function recordDecision(
  decisionId: string,
  option: string,
  note: string
): Promise<ActionResult<{ decisionId: string }>> {
  return run(async () => {
    await decideDecision(decisionId, option, note);
    revalidate();
    return { decisionId };
  });
}

export async function reopenProfessorDecision(
  decisionId: string
): Promise<ActionResult<{ decisionId: string }>> {
  return run(async () => {
    await reopenDecision(decisionId);
    revalidate();
    return { decisionId };
  });
}
