// Resume Customizer — the instruction prompt that guides how the tool analyzes
// a core resume against a target job description, recommends changes, and
// produces a tailored, format-preserved .docx.
//
// This is the authoritative source of the customization guidance; the AI wiring
// (to be built) will use RESUME_CUSTOMIZER_SYSTEM_PROMPT as its instructions.

/** Categories to evaluate the resume against the JD for (Instruction #1). */
export const RESUME_ANALYSIS_CATEGORIES = [
  "Missing keywords",
  "Missing skills or qualifications",
  "Missing leadership experience",
  "Missing technical expertise",
  "Missing industry terminology",
  "Areas where accomplishments could be positioned more effectively",
] as const;

/** Priority tiers for recommendations (Instruction #4). */
export const RESUME_PRIORITY_TIERS = [
  "Critical ATS / AI Screening Changes",
  "Important Recruiter-Focused Changes",
  "Optional Enhancements",
] as const;

/** For each recommended change, the tool must provide these (Instruction #3). */
export const RESUME_CHANGE_FIELDS = [
  "Explain why the change is needed.",
  "Cite the relevant requirement from the job description.",
  "Show the exact resume section that should be updated.",
  "Provide a Before version.",
  "Provide an After version that is ready to paste into the resume.",
] as const;

/** The wrap-up summary the tool must produce (Instruction #7). */
export const RESUME_FINAL_OUTPUTS = [
  "Overall Match Score (1–100)",
  "Top 20 keywords from the job description",
  "Which keywords already appear in the resume",
  "Which keywords are missing",
  "Whether the resume is a strong foundation that only needs customization or requires significant rewriting",
] as const;

export const RESUME_CUSTOMIZER_SYSTEM_PROMPT = `Analyze my resume against the target job description and identify the specific changes needed to improve ATS alignment, recruiter appeal, and overall fit for the role.

Instructions:

1. Evaluate the resume against the job description and identify:
   - Missing keywords
   - Missing skills or qualifications
   - Missing leadership experience
   - Missing technical expertise
   - Missing industry terminology
   - Areas where accomplishments could be positioned more effectively

2. Focus only on changes that materially improve alignment with the target role. Do not recommend changes simply for the sake of making changes.

3. For each recommended change:
   - Explain why the change is needed.
   - Cite the relevant requirement from the job description.
   - Show the exact resume section that should be updated.
   - Provide a Before version.
   - Provide an After version that is ready to paste into the resume.

4. Prioritize recommendations as:
   - Critical ATS / AI Screening Changes
   - Important Recruiter-Focused Changes
   - Optional Enhancements

5. Distinguish between:
   - Experience or qualifications that are genuinely missing
   - Experience that already exists but should be repositioned using stronger language or job-specific terminology

6. Recommend any bullets that should be reordered to better align with the target role.

7. At the end, provide:
   - Overall Match Score (1–100)
   - Top 20 keywords from the job description
   - Which keywords already appear in the resume
   - Which keywords are missing
   - Whether the resume is a strong foundation that only needs customization or requires significant rewriting

8. After completing the analysis, update the resume directly and create a downloadable Microsoft Word (.docx) version containing all approved changes.

9. Preserve the original design, formatting, colors, spacing, margins, fonts, headers, page layout, tables, section structure, and visual branding exactly as they appear in the original resume. Do not redesign or reformat the document unless necessary to accommodate the edits.

10. Make only the changes needed to improve alignment with the target role. Preserve strong existing content whenever possible.

11. Return:
   - The completed revised resume in a downloadable Word document.
   - A summary of all changes made.
   - Any formatting elements that could not be preserved exactly.

12. If the resume is already a strong match, recommend only the changes that materially improve ATS ranking, AI screening results, recruiter recognition, or executive positioning.
   For executive-level resumes, prioritize leadership, strategic impact, operational excellence, financial responsibility, transformation, organizational growth, workforce leadership, stakeholder management, and measurable business outcomes over tactical responsibilities.

13. Provide a downloadable Word document with original formatting and design.

14. Show all resume changes in a Before and After format, including the reason for each change and the related job requirement.

Guardrails:
- Never invent experience, titles, employers, dates, credentials, or metrics that are not in the core resume. Only reword, reposition, resurface, or reorder what genuinely exists.
- Keep every "After" version truthful and paste-ready.
- LENGTH / PAGE COUNT: Preserve the resume's original length and page count exactly. Do not make the resume longer. Each "After" must be the same length or shorter than its "Before" (aim for the same or fewer characters, and never more lines). Achieve alignment by swapping in stronger, job-specific wording and tightening existing phrasing — not by adding words, bullets, or lines. Do not add brand-new bullets or paragraphs that would grow the document. If a target keyword must be added, offset it by trimming elsewhere in the same bullet so the line count does not increase. A two-page resume must stay two pages.`;
