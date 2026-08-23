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
  /^(?:\d+\s+new\s+jobs?\s+(?:for|similar)|apply for these|new jobs in|new jobs similar|all .+ jobs from|\d+\+\s+|fresh .+ jobs for you|execthread job listings|new jobs on |what % of your resume|just in: new jobs|new opportunity alert)/i;

const GOOGLE_ALERT_PREFIX_RE =
  /^["'“][\s\S]+?["'”]\s*:\s*/;

/** LinkedIn / Indeed marketing prefixes on subject lines and card titles. */
const PROMO_PREFIX_RES: RegExp[] = [
  /^Be the first to apply to\s+/i,
  /^Be among the first to apply to\s+/i,
  /^Top match[:\s-]+/i,
  /^Top job match[:\s-]+/i,
  /^New jobs similar to\s+/i,
  /^New job similar to\s+/i,
  /^Jobs similar to\s+/i,
  /^Similar jobs? to\s+/i,
  /^Recommended for you:\s*/i,
  /^You['']?d be a great fit for\s+/i,
  /^You might be a good fit for\s+/i,
  /^You would be a great fit for\s+/i,
  /^Act fast[!.\s]+/i,
  /^Hot job alert:\s*/i,
  /^Featured job:\s*/i,
  /^New opportunity alert[!:.]?\s*/i,
  /^New jobs? for\s+["“].+["”]\s*[-–—]\s*/i,
  /^Now hiring:\s*/i,
  /^✉️\s*/,
  /^🚀\s*/,
];

const DIGEST_SUFFIX_RES: RegExp[] = [
  /\s+and\s+\d+\s+more\s+jobs?.*$/i,
  /\s+for you\.\s*Apply Now\.?\s*$/i,
  /\s+Apply Now\.?\s*$/i,
  /:\s*you would be a great fit!?\s*$/i,
  /\s+posted on\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/i,
];

const GARBAGE_COMPANY_RE =
  /you would be a great fit|you'd be a great fit|and \d+ more jobs|apply now|posted on|for you\.?\s*$|^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}$/i;

const GARBAGE_TITLE_RE =
  /^(top match|new jobs similar|be the first|be among the first|ladders|linkedin|indeed|new opportunity|similar jobs?|recommended for you|just in:)/i;

const WEAK_TITLE_RE =
  /^(view|apply|see (all )?jobs?|read more|click here|linkedin|indeed|ladders|job alert|open|vice president of marketing)$/i;

function peelHiringPhrase(text: string): { text: string; company: string | null } {
  const m = text.match(/^(.+?)\s+is hiring (?:a|an)\s+(.+)$/i);
  if (m && m[1].length >= 2 && m[1].length <= 60) {
    return { text: m[2].trim(), company: m[1].trim() };
  }
  return { text, company: null };
}

function stripPromoPrefixes(text: string): string {
  let out = text.trim();
  for (let i = 0; i < 6; i++) {
    let changed = false;
    for (const re of PROMO_PREFIX_RES) {
      const next = out.replace(re, "").trim();
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

export function isGarbageCompany(company: string | null | undefined): boolean {
  if (!company?.trim()) return true;
  const c = company.trim();
  if (c.length < 2 || c.length > 80) return true;
  return GARBAGE_COMPANY_RE.test(c) || WEAK_TITLE_RE.test(c);
}

export function isGarbageTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) return true;
  const t = title.trim();
  if (t.length < 3) return true;
  if (WEAK_TITLE_RE.test(t)) return true;
  if (GARBAGE_TITLE_RE.test(t)) return true;
  if (DIGEST_ONLY_RE.test(t)) return true;
  return false;
}

/** True when the line is a multi-job digest header with no specific role. */
export function isDigestOnlyTitle(raw: string): boolean {
  const t = cleanJobAlertTitle(raw);
  if (!t) return true;
  return isGarbageTitle(t) || DIGEST_ONLY_RE.test(t);
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

  text = stripPromoPrefixes(text);

  const peeled = peelHiringPhrase(text);
  text = peeled.text;

  for (const re of DIGEST_SUFFIX_RES) {
    text = text.replace(re, "").trim();
  }

  text = text.replace(/\s+role at\s+/i, " at ");
  text = text.replace(/:\s*you (?:would|'d) be a great fit!?\s*$/i, "");
  text = text.replace(
    /\s+-\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\s*$/i,
    ""
  );
  text = text.replace(/^Group \d+\s*-\s*/i, "").trim();
  text = text.replace(/^["'“]+|["'”]+$/g, "").trim();
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
    if (company && !isGarbageCompany(company)) {
      return { roleTitle, company };
    }
  }

  const at = text.match(/^(.+?)\s+@\s+(.+)$/);
  if (at) {
    const roleTitle = at[1].trim();
    const companyPart = extractSalary(at[2].trim());
    const company = companyPart.rest || null;
    if (!isGarbageCompany(company)) {
      return { roleTitle, company };
    }
  }

  const parts = text.split(/\s+[—–]\s+/);
  if (parts.length >= 2) {
    const roleTitle = parts[0].trim();
    const company = parts.slice(1).join(" — ").trim();
    const cleaned = extractSalary(company);
    const co = cleaned.rest || null;
    if (!isGarbageCompany(co)) {
      return { roleTitle, company: co };
    }
  }

  const dashTail = text.match(/^(.+?)\s+-\s+([A-Za-z][A-Za-z0-9 .&']{1,58})$/);
  if (dashTail && !isGarbageCompany(dashTail[2])) {
    return { roleTitle: dashTail[1].trim(), company: dashTail[2].trim() };
  }

  return { roleTitle: text.trim(), company: null };
}

/** Turn a title string into structured fields when company/comp are missing. */
export function parseOpportunityLine(raw: string): ParsedOpportunity {
  let text = cleanJobAlertTitle(raw);
  text = text.replace(META_SUFFIX_RE, "").trim();
  text = text.replace(/[.\s]+$/, "");

  const hiring = peelHiringPhrase(raw.replace(/\*\*/g, "").trim());
  let peeledCompany = hiring.company;

  const fromEnd = extractSalary(text);
  text = fromEnd.rest;
  let salary = fromEnd.salary;

  const { roleTitle, company } = splitRoleAndCompany(text);
  let resolvedCompany = company ?? peeledCompany;
  if (isGarbageCompany(resolvedCompany)) resolvedCompany = null;

  let resolvedTitle = roleTitle;
  if (isGarbageTitle(resolvedTitle)) {
    const fallback = splitRoleAndCompany(cleanJobAlertTitle(raw));
    if (!isGarbageTitle(fallback.roleTitle)) {
      resolvedTitle = fallback.roleTitle;
      if (!resolvedCompany && !isGarbageCompany(fallback.company)) {
        resolvedCompany = fallback.company;
      }
    }
  }

  if (!salary) {
    const inRole = extractSalary(resolvedTitle);
    if (inRole.salary) {
      resolvedTitle = inRole.rest;
      salary = inRole.salary;
    } else if (resolvedCompany) {
      const inCompany = extractSalary(resolvedCompany);
      if (inCompany.salary) {
        resolvedCompany = inCompany.rest || null;
        salary = inCompany.salary;
      }
    }
  }

  if (isGarbageTitle(resolvedTitle)) {
    resolvedTitle = cleanJobAlertTitle(raw);
  }

  return {
    roleTitle: resolvedTitle || cleanJobAlertTitle(raw) || raw.trim(),
    company: resolvedCompany,
    salary,
    rawTitle: raw,
  };
}

/** Normalize DB + subject into display fields: title, company, salary only. */
export function normalizeOpportunityFields(
  rawTitle: string,
  dbCompany: string | null | undefined,
  dbCompensation: string | null | undefined
): { title: string; company: string | null; compensation: string | null } {
  const parsed = parseOpportunityLine(rawTitle);

  const company =
    !isGarbageCompany(dbCompany) ? dbCompany!.trim() : parsed.company;

  const title = isGarbageTitle(parsed.roleTitle)
    ? cleanJobAlertTitle(rawTitle)
    : parsed.roleTitle;

  const compensation = dbCompensation?.trim() || parsed.salary || null;

  return {
    title: title.replace(/^["'“]+|["'”]+$/g, "").trim(),
    company: company ?? null,
    compensation,
  };
}
