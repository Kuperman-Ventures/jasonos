// Parse a job-alert title line into role title, company, and salary.

export interface ParsedOpportunity {
  roleTitle: string;
  company: string | null;
  salary: string | null;
  rawTitle: string;
}

const SALARY_TOKEN_RE =
  /(?:up to\s+\$[\d,.]+(?:k|K)?(?:\s*\/\s*(?:yr|year))?|\$[\d,.]+(?:k|K)?(?:\s*[–—-]\s*\$?[\d,.]+(?:k|K)?)?(?:\s*\/\s*(?:yr|year))?)/i;

const META_SUFFIX_RE =
  /\s*\([^)]*(?:Indeed|LinkedIn|Lensa|Glassdoor|match|sent\s+(?:twice\s+)?(?:Aug|Jul|Mon|Tue|Wed|Thu|Fri|Sat|Sun))[^)]*\)\s*$/i;

/** Subject lines that are search digests, not a single role. */
const DIGEST_ONLY_RE =
  /^(?:\d+\s+new\s+jobs?\s+for|apply for these|new jobs in|all .+ jobs from|\d+\+\s+|fresh .+ jobs for you|execthread job listings|new jobs on |what % of your resume)/i;

const GOOGLE_ALERT_PREFIX_RE =
  /^["'“][\s\S]+?["'”]\s*:\s*/;

const DIGEST_SUFFIX_RES: RegExp[] = [
  /\s+and\s+\d+\s+more\s+jobs?.*$/i,
  /\s+for you\.\s*Apply Now\.?\s*$/i,
  /\s+Apply Now\.?\s*$/i,
  /:\s*you would be a great fit!?\s*$/i,
  /\s+posted on\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/i,
  /^Now hiring:\s*/i,
  /^✉️\s*/,
];

/** True when the line is a multi-job digest header with no specific role. */
export function isDigestOnlyTitle(raw: string): boolean {
  const t = cleanJobAlertTitle(raw);
  if (!t) return true;
  return DIGEST_ONLY_RE.test(t);
}

/** Strip alert-service cruft so titles read like role + company, not search queries. */
export function cleanJobAlertTitle(raw: string): string {
  let text = raw.replace(/\*\*/g, "").trim();
  if (!text) return text;

  if (/^["'“]/.test(text) && /\s:\s+\S/.test(text)) {
    const parts = text.split(/\s*:\s+/);
    if (parts.length >= 2 && parts[0].length < 140) {
      text = parts.slice(1).join(": ").trim();
    }
  } else if (GOOGLE_ALERT_PREFIX_RE.test(text)) {
    text = text.replace(GOOGLE_ALERT_PREFIX_RE, "").trim();
  }

  for (const re of DIGEST_SUFFIX_RES) {
    text = text.replace(re, "").trim();
  }

  text = text.replace(/\s+role at\s+/i, " at ");
  return text.replace(/[.\s]+$/, "").trim();
}

function extractSalary(text: string): { rest: string; salary: string | null } {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+[—–]\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    const m = last.match(SALARY_TOKEN_RE);
    if (m && m.index === 0 && m[0].length === last.length) {
      const salary = m[0].trim();
      parts.pop();
      return { rest: parts.join(" — ").trim(), salary };
    }
  }

  const inline = trimmed.match(SALARY_TOKEN_RE);
  if (inline) {
    const salary = inline[0].trim();
    const rest = trimmed
      .replace(inline[0], "")
      .replace(/\s*[—–-]\s*$/, "")
      .replace(/:\s*$/, "")
      .trim();
    return { rest, salary };
  }

  return { rest: trimmed, salary: null };
}

function splitRoleAndCompany(text: string): { roleTitle: string; company: string | null } {
  const roleAt = text.match(/^(.+?)\s+at\s+(.+)$/i);
  if (roleAt) {
    const roleTitle = roleAt[1].trim();
    const companyPart = extractSalary(roleAt[2].trim());
    const company = companyPart.rest || null;
    if (company && company.length >= 2 && company.length <= 80) {
      return { roleTitle, company };
    }
  }

  const at = text.match(/^(.+?)\s+@\s+(.+)$/);
  if (at) {
    const roleTitle = at[1].trim();
    const companyPart = extractSalary(at[2].trim());
    return {
      roleTitle,
      company: companyPart.rest || null,
    };
  }

  const parts = text.split(/\s+[—–]\s+/);
  if (parts.length >= 2) {
    const roleTitle = parts[0].trim();
    const company = parts.slice(1).join(" — ").trim();
    const cleaned = extractSalary(company);
    return { roleTitle, company: cleaned.rest || null };
  }

  const dashTail = text.match(/^(.+?)\s+-\s+([A-Za-z][A-Za-z0-9 .&']{1,58})$/);
  if (dashTail) {
    return { roleTitle: dashTail[1].trim(), company: dashTail[2].trim() };
  }

  return { roleTitle: text.trim(), company: null };
}

/** Turn a title string into structured fields when company/comp are missing. */
export function parseOpportunityLine(raw: string): ParsedOpportunity {
  let text = cleanJobAlertTitle(raw);
  text = text.replace(META_SUFFIX_RE, "").trim();
  text = text.replace(/[.\s]+$/, "");

  const fromEnd = extractSalary(text);
  text = fromEnd.rest;
  let salary = fromEnd.salary;

  const { roleTitle, company } = splitRoleAndCompany(text);

  if (!salary) {
    const inRole = extractSalary(roleTitle);
    if (inRole.salary) {
      return {
        roleTitle: inRole.rest,
        company,
        salary: inRole.salary,
        rawTitle: raw,
      };
    }
    if (company) {
      const inCompany = extractSalary(company);
      if (inCompany.salary) {
        return {
          roleTitle,
          company: inCompany.rest || null,
          salary: inCompany.salary,
          rawTitle: raw,
        };
      }
    }
  }

  return {
    roleTitle: roleTitle || raw.trim(),
    company,
    salary,
    rawTitle: raw,
  };
}
