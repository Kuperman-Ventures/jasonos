import timeline from "@/content/timeline.json";
import faq from "@/content/faq.json";
import coreSections from "@/content/app-questions-core-sections.json";
import essayPrompts from "@/content/app-questions-essay-prompts.json";
import writingSections from "@/content/app-questions-writing-sections.json";
import demographics from "@/content/app-questions-demographics-history.json";
import supplementalTypes from "@/content/app-questions-supplemental-types.json";
import firms from "@/content/consultant-firms.json";
import criteria from "@/content/consultant-criteria.json";
import scoreSeed from "@/content/consultant-scores-seed.json";
import questions from "@/content/consultant-questions.json";
import schoolsFile from "@/content/schools.json";
import prepQuestions from "@/content/prep-questions.json";
import type {
  Criterion,
  FaqCategory,
  Firm,
  Phase,
  School,
  Scores,
  SelectivityGuide,
  Supplemental,
  TextBlock,
} from "./types";
import { fromSeed } from "./types";

export const phases = timeline as Phase[];
export const faqCategories = faq as FaqCategory[];
export const appCore = coreSections as TextBlock[];
export const essayPromptList = essayPrompts as string[];
export const writingBlocks = writingSections as TextBlock[];
export const demographicBlocks = demographics as TextBlock[];
export const supplementCards = supplementalTypes as Supplemental[];
export const consultantFirms = firms as Firm[];
export const consultantCriteria = criteria as Criterion[];
export const consultantQuestions = questions as string[];
export const seedScores = scoreSeed as Scores;
export const selectivityGuide = schoolsFile.selectivityGuide as SelectivityGuide[];
export const prep = prepQuestions;

export function seedSchools(): School[] {
  return schoolsFile.schools.map(fromSeed);
}
