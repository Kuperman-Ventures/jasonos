/**
 * App Questions — single typed data module for the redesigned tab.
 * Copy is verbatim from college/content/*; structure matches the HTML reference.
 */

export type AppQuestionSourceId =
  | "commonApp"
  | "uc"
  | "yale"
  | "mit"
  | "michigan"
  | "tufts";

export const APP_QUESTION_SOURCES: { id: AppQuestionSourceId; label: string }[] = [
  { id: "commonApp", label: "Common App" },
  { id: "uc", label: "UC" },
  { id: "yale", label: "Yale" },
  { id: "mit", label: "MIT" },
  { id: "michigan", label: "Michigan" },
  { id: "tufts", label: "Tufts" },
];

export const WORD_AXIS_MAX = 650;

export function wordPct(words: number): number {
  return (words / WORD_AXIS_MAX) * 100;
}

export function barLayout(
  minWords: number,
  maxWords: number,
): { leftPct: number; widthPct: number; labelInside: boolean } {
  return {
    leftPct: wordPct(minWords),
    widthPct: wordPct(maxWords - minWords),
    labelInside: maxWords / WORD_AXIS_MAX > 0.7,
  };
}

export type CoreTile = {
  name: string;
  description: string;
  tag?: string;
  accent?: boolean;
};

export type EssayPrompt = {
  n: number;
  label: string;
  text: string;
};

export type OtherWritingEntry = {
  name: string;
  description: string;
  maxWords: number;
  optional: boolean;
};

export type DemographicsEntry = {
  name: string;
  description: string;
  meta: string;
  metaAccent?: boolean;
};

export type WordBarKind = "accent" | "optional" | "required";

export type WordBar = {
  minWords: number;
  maxWords: number;
  label: string;
  kind: WordBarKind;
};

export type SchoolRulerRow = {
  name: string;
  strong?: boolean;
  bars: WordBar[];
};

export type FormatNote = {
  name: string;
  format: string;
};

export type SupplementTheme = {
  name: string;
  example: string;
  sourceLine: string;
  wants?: string;
};

export type QuestionGroupId = "core" | "additional" | "routine";

export type QuestionGroupMeta = {
  id: QuestionGroupId;
  name: string;
  rangeLabel: string;
  evidenceLabel: string;
};

export type AppQuestion = {
  n: number;
  question: string;
  group: QuestionGroupId;
  sources: AppQuestionSourceId[];
  evidence: string;
  preparation?: string;
};

export type PrepBank = {
  title: string;
  text: string;
};

export type TocSectionId = "core" | "essay" | "other" | "schools" | "questions" | "prep";

export type TocItem = {
  /** Anchor id (other + demographics both use #other). */
  id: TocSectionId;
  num: string;
  name: string;
  meta: string;
  accent?: boolean;
};

export function sourceCounts(
  questions: AppQuestion[],
): Record<AppQuestionSourceId, number> {
  const counts = Object.fromEntries(
    APP_QUESTION_SOURCES.map(({ id }) => [id, 0]),
  ) as Record<AppQuestionSourceId, number>;
  for (const q of questions) {
    for (const id of q.sources) {
      counts[id] += 1;
    }
  }
  return counts;
}

/** Dot fill: core = strong ink; additional/routine = soft. */
export function sourceDotStrength(
  group: QuestionGroupId,
): "strong" | "soft" {
  return group === "core" ? "strong" : "soft";
}

export function formatQuestionNum(n: number): string {
  return String(n).padStart(2, "0");
}

export function tocMetaCore(tiles: { length: number }): string {
  return `${tiles.length} forms`;
}

export function tocMetaEssay(prompts: { length: number }, min: number, max: number): string {
  return `1 of ${prompts.length} · ${min}–${max}`;
}

export function tocMetaOther(entries: { length: number }): string {
  return `${entries.length} optional`;
}

export function tocMetaDemographics(entries: { length: number }): string {
  return `${entries.length} sections`;
}

export function tocMetaSchools(themeCount: number, schoolCount: number): string {
  return `${themeCount} themes · ${schoolCount} schools`;
}

export function tocMetaQuestions(questions: { length: number }): string {
  return `${questions.length} questions`;
}

export function tocMetaPrep(banks: { length: number }): string {
  return `${banks.length} story banks`;
}

const ESSAY_MIN = 250;
const ESSAY_MAX = 650;

const coreTiles: CoreTile[] = [
  {
    name: "Profile",
    description:
      "Personal information (legal name, preferred name, former name if applicable), current and permanent address, phone and email, demographics subsection (see below), language spoken at home, geography and nationality (citizenship, place of birth, visa status), and whether Kyle is applying for a Common App fee waiver.",
  },
  {
    name: "Family",
    description:
      'Household - who Kyle currently lives with. Details for up to two parents/guardians, including their highest level of education (this is how first-generation status gets determined - there\'s no direct "are you first-gen" question). Sibling information, including where siblings attend or attended college.',
  },
  {
    name: "Education",
    description:
      "Current and any other high schools attended. Colleges already attended, if any. Grades and GPA information. Current-year courses. Honors, up to five, with level of recognition. Community-based organizations worked with in the process. A short future-plans question on career interest.",
  },
  {
    name: "Testing",
    tag: "Optional",
    description:
      "Self-reported standardized test scores. Optional, and only matters at schools requiring or considering scores.",
  },
  {
    name: "Activities",
    tag: "Up to 10",
    description:
      "Up to 10 activities. For each: activity type from a list (athletics, art, community service, debate/speech, foreign language, research, social justice, work, and others), position/leadership (50-character limit), organization name (100-character limit), description (150-character limit, roughly 20-25 words), grade levels participated, timing (school year, break, or all year), hours per week, weeks per year, and intent to continue in college.",
  },
  {
    name: "Courses and Grades",
    tag: "Some colleges",
    accent: true,
    description:
      "School name, school year, grading scale, every course by subject and name, course level, and grade earned - essentially a self-reported transcript.",
  },
];

const essayPrompts: EssayPrompt[] = [
  {
    n: 1,
    label: "Background & identity",
    text: "Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.",
  },
  {
    n: 2,
    label: "Challenge or setback",
    text: "The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?",
  },
  {
    n: 3,
    label: "Questioning a belief",
    text: "Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?",
  },
  {
    n: 4,
    label: "Gratitude",
    text: "Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?",
  },
  {
    n: 5,
    label: "Personal growth",
    text: "Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.",
  },
  {
    n: 6,
    label: "Intellectual curiosity",
    text: "Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?",
  },
  {
    n: 7,
    label: "Topic of your choice",
    text: "Share an essay on any topic of your choice. It can be one you've already written, one that responds to a different prompt, or one of your own design.",
  },
];

const otherWriting: OtherWritingEntry[] = [
  {
    name: "Challenges and Circumstances",
    maxWords: 250,
    optional: true,
    description:
      "A newer, permanent section for hardships that affected Kyle's application - housing instability, family disruption, discrimination, or lack of access to study space or technology. Only worth using if something real applies.",
  },
  {
    name: "Additional Information",
    maxWords: 300,
    optional: true,
    description:
      "A separate box for context that doesn't fit anywhere else - an academic anomaly with an explanation, an activity that needed more room than the 150-character limit allowed, or a work sample reference. Not a place for a second essay.",
  },
];

const demographics: DemographicsEntry[] = [
  {
    name: "Demographics Page",
    meta: "Entirely optional",
    description:
      'Race/ethnicity (select one or more), religious preference (dropdown, includes "none" and "prefer not to answer"), and U.S. armed forces status. Kyle can skip every question here with no penalty - used for reporting and outreach, not as an admission filter at most schools.',
  },
  {
    name: "Disciplinary and Criminal History",
    meta: "Check per school",
    metaAccent: true,
    description:
      "The Common App itself no longer asks about high school disciplinary history (removed 2020) or criminal history (removed 2019) in its standard core. Individual member colleges can still add either question through their own supplement, so it needs to be checked per school rather than assumed absent.",
  },
];

const rulerRows: SchoolRulerRow[] = [
  {
    name: "Common App",
    strong: true,
    bars: [
      { minWords: 250, maxWords: 650, label: "Personal essay", kind: "accent" },
      { minWords: 0, maxWords: 250, label: "Challenges · optional", kind: "optional" },
      { minWords: 0, maxWords: 300, label: "Additional info · optional", kind: "optional" },
    ],
  },
  {
    name: "UC",
    bars: [
      { minWords: 0, maxWords: 350, label: "×4 of 8 personal insight", kind: "required" },
    ],
  },
  {
    name: "Michigan",
    bars: [
      { minWords: 100, maxWords: 300, label: "Contribution", kind: "required" },
      { minWords: 100, maxWords: 500, label: "School / curriculum fit", kind: "required" },
    ],
  },
  {
    name: "Yale",
    bars: [
      { minWords: 0, maxWords: 200, label: "Academic interest", kind: "required" },
      {
        minWords: 0,
        maxWords: 35,
        label: "×3 short takes · 200 characters",
        kind: "required",
      },
    ],
  },
  {
    name: "MIT",
    bars: [
      { minWords: 100, maxWords: 200, label: "×4 main essays", kind: "required" },
      { minWords: 40, maxWords: 50, label: "×4 short responses", kind: "required" },
    ],
  },
  {
    name: "Tufts",
    bars: [
      { minWords: 100, maxWords: 200, label: "Program-specific question", kind: "required" },
    ],
  },
];

/** Format notes under the ruler — verbatim from prep-questions.json. */
const formatNotes: FormatNote[] = [
  {
    name: "UC",
    format:
      "Choose four of eight personal insight questions; each response has a 350-word maximum, and all question choices receive equal consideration (UC).",
  },
  {
    name: "Michigan",
    format:
      "Two university-specific essays are required for all applicants: a 100–300-word contribution essay and a 100–500-word school/curriculum-fit essay (Michigan).",
  },
  {
    name: "Yale",
    format:
      "For 2026–27, all first-year applicants identify academic areas and answer an academic-interest question of up to 200 words; Common App and Coalition applicants also answer three short takes of up to 200 characters each and choose one of three essays of up to 400 words (Yale).",
  },
  {
    name: "MIT",
    format:
      "For 2026–27, the page lists four main essays, approximately 100–200 words depending on the question, plus four short responses with room for 40–50 words each (MIT).",
  },
  {
    name: "Tufts",
    format:
      "Class of 2031 applicants answer two required short answers: a 75–150-word engagement question and a 100–200-word program-specific question (Tufts).",
  },
];

const supplementThemes: SupplementTheme[] = [
  {
    name: "Why This College",
    example: "School-specific - no standard wording.",
    sourceLine: "Every school",
    wants:
      "Requires naming actual courses, programs, or professors; can't be recycled across schools without real editing.",
  },
  {
    name: "Why This Major",
    example: '"Why are you interested in the major you indicated?"',
    sourceLine: "UT Austin · 250–300 words",
    wants: "Wants a connection to real experience, not just stated interest.",
  },
  {
    name: "Community",
    example: '"Reflect on your membership in a community to which you feel connected."',
    sourceLine: "Yale · 400 words",
    wants: "Wants an actual group and Kyle's specific role in it.",
  },
  {
    name: "Extracurricular Elaboration",
    example: "As short as 3–50 words in recent cycles.",
    sourceLine: "Stanford",
    wants: "Wants depth on one listed activity, not a repeat of the activities list.",
  },
  {
    name: "Diversity / Perspective",
    example: '"How has your lived experience shaped you?"',
    sourceLine: "Princeton · ~500 words",
    wants:
      "Wants a concrete lived experience and how it shaped your perspective.",
  },
];

export const QUESTION_GROUPS: QuestionGroupMeta[] = [
  {
    id: "core",
    name: "Core essay and short-answer questions",
    rangeLabel: "01–12 · most common",
    evidenceLabel: "Verified examples of the theme",
  },
  {
    id: "additional",
    name: "Additional essay questions worth preparing",
    rangeLabel: "13–20 · platform- or school-specific",
    evidenceLabel: "Where it appears",
  },
  {
    id: "routine",
    name: "Routine application questions beyond essays",
    rangeLabel: "21+ · factual",
    evidenceLabel: "Evidence and qualification",
  },
];

const matrixQuestions: AppQuestion[] = [
  {
    n: 1,
    group: "core",
    question: "What do you want to study, and why does it interest you?",
    sources: ["uc", "yale", "mit"],
    evidence:
      "Yale asks applicants to identify academic areas and explain an exciting related topic; MIT asks what led to an interest in a field; UC asks about an inspiring academic subject (Yale, MIT, UC).",
    preparation:
      "Identify how the interest started, how you pursued it, and what you want to explore next.",
  },
  {
    n: 2,
    group: "core",
    question:
      "What background, identity, interest, or talent is essential to understanding you?",
    sources: ["commonApp", "yale"],
    evidence:
      "Common App offers a background/identity/interest/talent prompt; Yale asks how a personal experience shaped the applicant and could enrich college (Common App, Yale).",
    preparation:
      "Choose a concrete experience that reveals something not obvious from grades and activities.",
  },
  {
    n: 3,
    group: "core",
    question:
      "Describe a challenge, setback, or failure. How did you respond, and what did you learn?",
    sources: ["commonApp", "uc", "mit"],
    evidence:
      "Variations appear in Common App, UC, and MIT questions (Common App, UC, MIT).",
    preparation:
      "Prepare the situation, your actions, the outcome, and an honest reflection.",
  },
  {
    n: 4,
    group: "core",
    question:
      "How have you contributed to your community, and how will you contribute in college?",
    sources: ["uc", "mit", "michigan"],
    evidence:
      "UC asks about improving a school or community; Michigan asks how applicants will contribute to its leadership and citizenship goals; MIT connects future impact with personal and academic experiences (UC, Michigan, MIT).",
    preparation:
      "Distinguish past contributions from future intentions, and make your individual role clear.",
  },
  {
    n: 5,
    group: "core",
    question: "Why this college, school, or academic program?",
    sources: ["michigan", "tufts"],
    evidence:
      "Michigan directly asks about the qualities of the specific undergraduate school and how its curriculum supports the applicant’s interests; Tufts asks the related but distinct question of how applicants learned about and engaged with Tufts (Michigan, Tufts).",
    preparation:
      "Connect your interests to specific opportunities. Do not treat “why us?” and “how did you engage with us?” as interchangeable.",
  },
  {
    n: 6,
    group: "core",
    question: "What idea or topic excites your curiosity?",
    sources: ["commonApp", "yale", "mit"],
    evidence:
      "Common App asks about an absorbing topic; Yale asks about an exciting academic idea; MIT asks what topic the applicant could discuss for hours (Common App, Yale, MIT).",
    preparation:
      "Explain what fascinates you and show how you explore it independently.",
  },
  {
    n: 7,
    group: "core",
    question:
      "What experience or realization changed how you understand yourself or others?",
    sources: ["commonApp", "yale"],
    evidence:
      "Common App asks about an accomplishment, event, or realization that sparked personal growth; Yale asks how personal experience shaped the applicant (Common App, Yale).",
    preparation:
      "Describe a meaningful before-and-after change in your thinking or behavior.",
  },
  {
    n: 8,
    group: "core",
    question: "Which activities, work, or responsibilities matter most to you?",
    sources: ["commonApp", "mit"],
    evidence:
      "Common App collects activities, work, hobbies, community engagement, and responsibilities; MIT asks applicants to describe their four most meaningful activities (Common App guide, MIT).",
    preparation:
      "Identify what you did, who benefited, and why the commitment matters.",
  },
  {
    n: 9,
    group: "core",
    question:
      "Tell us about a time you led, influenced others, or helped a group succeed.",
    sources: ["uc", "michigan"],
    evidence:
      "UC has a direct leadership prompt; Michigan’s contribution essay centers on developing leaders and citizens (UC, Michigan).",
    preparation: "Look for actions and effects, not just a title.",
  },
  {
    n: 10,
    group: "core",
    question:
      "Describe a time you questioned an idea or engaged with someone who disagreed with you.",
    sources: ["commonApp", "yale"],
    evidence:
      "Common App asks about questioning or challenging a belief; Yale asks about a meaningful discussion with someone holding an opposing view (Common App, Yale).",
    preparation:
      "Separate the two versions: changing your own thinking versus engaging with another person.",
  },
  {
    n: 11,
    group: "core",
    question: "What community do you belong to, and why is it meaningful?",
    sources: ["commonApp", "yale"],
    evidence:
      "Yale asks directly about membership in a meaningful community; Common App’s background and identity prompt provides a possible route for a related story (Yale, Common App).",
    preparation:
      "Explain your connection, your role, and how the community has shaped you.",
  },
  {
    n: 12,
    group: "core",
    question: "What else should we know that is missing from your application?",
    sources: ["uc", "yale", "mit"],
    evidence:
      "Yale has a short take on something not included elsewhere; MIT has an additional-information box; UC asks what else makes the applicant a strong candidate (Yale, MIT, UC).",
    preparation:
      "Identify important missing context, but distinguish a personality question from a factual additional-information field.",
  },
  {
    n: 13,
    group: "additional",
    question: "What is your greatest talent or skill, and how have you developed it?",
    sources: ["commonApp", "uc"],
    evidence:
      "UC asks this directly; Common App includes talent in its background/identity prompt (UC, Common App).",
  },
  {
    n: 14,
    group: "additional",
    question: "How do you express creativity or solve problems in an original way?",
    sources: ["uc"],
    evidence:
      "UC explicitly asks about creativity, including artistic expression, original thinking, and problem-solving (UC).",
  },
  {
    n: 15,
    group: "additional",
    question:
      "How have you used an educational opportunity or overcome an educational barrier?",
    sources: ["uc", "mit"],
    evidence:
      "UC asks this directly; MIT separately asks about doing something unexpected in one’s educational journey (UC, MIT).",
  },
  {
    n: 16,
    group: "additional",
    question:
      "What has someone done for you that inspired gratitude, and how did it affect you?",
    sources: ["commonApp"],
    evidence:
      "This is one of the seven Common App personal-essay options (Common App).",
  },
  {
    n: 17,
    group: "additional",
    question: "What do you do just for fun?",
    sources: ["mit"],
    evidence: "MIT asks this as a short response (MIT).",
  },
  {
    n: 18,
    group: "additional",
    question: "Who do you admire, and why?",
    sources: ["mit"],
    evidence:
      "MIT asks applicants to identify someone they admire, whether personally known or admired from afar (MIT).",
  },
  {
    n: 19,
    group: "additional",
    question:
      "Describe a favorite assignment, project, or creative work and explain your role or thinking.",
    sources: ["tufts"],
    evidence:
      "Tufts uses different versions for Arts and Sciences, Engineering, BFA, and combined-degree applicants (Tufts).",
  },
  {
    n: 20,
    group: "additional",
    question: "What aspect of yourself do you hope to grow or develop during college?",
    sources: ["yale"],
    evidence:
      "Yale includes this among its short takes for Common App and Coalition applicants (Yale).",
  },
  {
    n: 21,
    group: "routine",
    question: "What are your high school grades?",
    sources: ["commonApp"],
    evidence:
      "The Education section collects grades; some colleges also require a self-reported transcript (Common App guide).",
  },
  {
    n: 22,
    group: "routine",
    question: "What courses are you taking now?",
    sources: ["commonApp"],
    evidence:
      "Current courses are collected in the Education section (Common App guide).",
  },
  {
    n: 23,
    group: "routine",
    question: "What academic honors or achievements have you earned?",
    sources: ["commonApp"],
    evidence:
      "Applicants have an opportunity to report high school academic honors and achievements (Common App guide).",
  },
  {
    n: 24,
    group: "routine",
    question:
      "What clubs, extracurricular activities, and hobbies do you participate in?",
    sources: ["commonApp"],
    evidence:
      "These are examples of information for the Activities section (Common App guide).",
  },
  {
    n: 25,
    group: "routine",
    question: "What paid work or other responsibilities do you have?",
    sources: ["commonApp"],
    evidence:
      "Common App identifies work and responsibilities as relevant application information (Common App guide).",
  },
  {
    n: 26,
    group: "routine",
    question: "What community engagement have you participated in?",
    sources: ["commonApp"],
    evidence:
      "Community engagement is another Activities section example (Common App guide).",
  },
  {
    n: 27,
    group: "routine",
    question: "What standardized tests have you taken, and what are your scores?",
    sources: ["commonApp"],
    evidence:
      "Applicants may self-report test scores; testing policies differ by college (Common App guide).",
  },
  {
    n: 28,
    group: "routine",
    question: "What are your parents’ or guardians’ occupations and employment status?",
    sources: ["commonApp"],
    evidence:
      "Common App identifies these as Family section information (Common App guide).",
  },
  {
    n: 29,
    group: "routine",
    question: "What education have your parents or guardians completed?",
    sources: ["commonApp"],
    evidence:
      "Questions include education level and, where applicable, colleges attended and degrees earned (Common App guide).",
  },
  {
    n: 30,
    group: "routine",
    question: "Are there circumstances or challenges that help explain your application?",
    sources: ["michigan", "uc"],
    evidence:
      "Michigan describes the Common App’s optional challenges-and-circumstances question; UC provides additional comments for unusual circumstances or clarification (Michigan, UC).",
  },
];

const prepBanks: PrepBank[] = [
  {
    title: "Personal story",
    text: "Identify experiences that reveal your background, values, or identity.",
  },
  {
    title: "Academic interest",
    text: "List subjects, assignments, projects, books, or questions you have pursued.",
  },
  {
    title: "Challenge and growth",
    text: "Prepare an honest account of what happened, what you did, and what changed.",
  },
  {
    title: "Contribution and leadership",
    text: "Capture your role and impact in a group, workplace, family, or community.",
  },
  {
    title: "Meaningful commitment",
    text: "Identify an activity or responsibility that shows sustained effort.",
  },
  {
    title: "College fit",
    text: "Keep school-specific notes separate from reusable personal stories.",
  },
];

const prepApproachIntro =
  "Build a bank of experiences before drafting polished answers. This is a suggested workflow, not an admissions requirement.";

const prepApproachClosing =
  "Use this list to brainstorm, then adapt to each actual prompt rather than reusing an answer unchanged. In particular, do not turn every additional-information box into another personal essay: UC explicitly says its additional-comments field should clarify relevant circumstances and should not be an essay (UC).";

/** Schools counted in TOC meta = format notes (excl. Common App ruler row). */
const schoolCountForToc = formatNotes.length;

function buildToc(): TocItem[] {
  return [
    {
      id: "core",
      num: "01",
      name: "Core sections",
      meta: tocMetaCore(coreTiles),
    },
    {
      id: "essay",
      num: "02",
      name: "Personal essay",
      meta: tocMetaEssay(essayPrompts, ESSAY_MIN, ESSAY_MAX),
    },
    {
      id: "other",
      num: "03",
      name: "Other writing",
      meta: tocMetaOther(otherWriting),
    },
    {
      id: "other",
      num: "04",
      name: "Demographics",
      meta: tocMetaDemographics(demographics),
    },
    {
      id: "schools",
      num: "05",
      name: "School supplements",
      meta: tocMetaSchools(supplementThemes.length, schoolCountForToc),
    },
    {
      id: "questions",
      num: "06",
      name: "Questions to prep",
      meta: tocMetaQuestions(matrixQuestions),
      accent: true,
    },
    {
      id: "prep",
      num: "07",
      name: "Prep approach",
      meta: tocMetaPrep(prepBanks),
    },
  ];
}

export const appQuestions = {
  intro:
    "The actual fields and prompts on the application itself: the Common App core, plus what each school adds on top. Current as of the 2026–27 cycle; reconfirm once Kyle's Common App account is open next summer.",

  toc: buildToc(),

  core: {
    id: "core" as const,
    label: "01 · Common App core sections",
    title: "Six forms every school sees",
    tiles: coreTiles,
  },

  essay: {
    id: "essay" as const,
    label: "02 · Personal essay",
    title: "Pick one of seven",
    minWords: ESSAY_MIN,
    maxWords: ESSAY_MAX,
    prompts: essayPrompts,
    note: "These are alternatives, not seven essays to submit. Whether the personal essay is required depends on the college.",
  },

  otherWriting: {
    id: "other" as const,
    label: "03 · Other writing sections",
    entries: otherWriting,
  },

  demographics: {
    /** Shares #other with otherWriting. */
    id: "other" as const,
    label: "04 · Demographics and history",
    entries: demographics,
  },

  schools: {
    id: "schools" as const,
    label: "05 · What each school adds",
    title: "Supplements drive the word count",
    lede: "Supplement limits run from a few words to 650. On a full list, the supplements are what make up most of the writing, not the one Common App essay.",
    axisMax: WORD_AXIS_MAX,
    axisTicks: [0, 100, 200, 300, 400, 500, 650] as const,
    rulerKey: "Words · bar spans the allowed range · ×n = number of responses",
    ruler: rulerRows,
    formats: formatNotes,
    themes: supplementThemes,
  },

  questions: {
    id: "questions" as const,
    label: "06 · Questions to prepare for",
    title: "Common questions, and where they show up",
    lede: "A practical list to prepare for, not a ranked national top 30. Questions are normalized paraphrases. Research checked September 19, 2026. Select a question for its examples and suggested preparation.",
    sources: APP_QUESTION_SOURCES,
    groups: QUESTION_GROUPS,
    items: matrixQuestions,
    preparationLabel: "Suggested preparation",
    footerLabel: "Questions each source covers",
  },

  prep: {
    id: "prep" as const,
    label: "07 · Recommended preparation approach",
    title: "Build a bank of experiences first",
    lede: prepApproachIntro,
    banks: prepBanks,
    closing: prepApproachClosing,
  },
} as const;

export type AppQuestionsData = typeof appQuestions;
