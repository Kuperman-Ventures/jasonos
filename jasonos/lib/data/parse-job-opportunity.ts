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

  return { roleTitle: text.trim(), company: null };
}

/** Turn a title string into structured fields when company/comp are missing. */
export function parseOpportunityLine(raw: string): ParsedOpportunity {
  let text = raw.replace(/\*\*/g, "").trim();
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
