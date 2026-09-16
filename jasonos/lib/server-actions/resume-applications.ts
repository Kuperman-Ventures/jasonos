"use server";

// Bridge between Custom Communications and NYUI: every customized resume is a
// job application. This exposes the "to log" queue (customizations not yet
// logged as an NYS DOL work search) with company / URL / role pre-extracted,
// and marks a customization logged once it's added to NYUI.

import { revalidatePath } from "next/cache";
import { gateway } from "@ai-sdk/gateway";
import { generateText, stepCountIs } from "ai";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  pickBestCompanyUrl,
  pickCompanyUrlFromText,
  type CompanyUrlContext,
  type CompanyUrlSource,
} from "@/lib/nyui/work-search-url";

export interface ResumeApplication {
  customizationId: string;
  company: string | null;
  roleTitle: string | null;
  url: string | null;
  filename: string;
  createdAt: string;
}

export type FindCompanyUrlResult =
  | { ok: true; url: string; source: CompanyUrlSource }
  | { ok: false; error: string };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function roleFromReport(report: unknown): string | null {
  const analysis = (report as { analysis?: { roleTitle?: unknown } } | null)?.analysis;
  return typeof analysis?.roleTitle === "string" && analysis.roleTitle.trim()
    ? analysis.roleTitle.trim()
    : null;
}

function companyUrlFromCustomization(
  jobDescription: string | null,
  report: unknown,
  ctx: CompanyUrlContext
): string | null {
  const blobs = [
    jobDescription ?? "",
    typeof report === "string" ? report : JSON.stringify(report ?? {}),
  ];
  return pickCompanyUrlFromText(blobs.join("\n"), ctx);
}

export async function getResumeApplicationQueue(): Promise<ResumeApplication[]> {
  if (!hasConfig()) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("resume_customizations")
    .select("id,company,filename,job_description,report,created_at,nyui_logged_at")
    .is("nyui_logged_at", null)
    .is("nyui_dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    console.error("[resume-applications.getResumeApplicationQueue]", error);
    return [];
  }
  return (data ?? []).map((row) => {
    const company = (row.company as string | null) ?? null;
    return {
      customizationId: row.id as string,
      company,
      roleTitle: roleFromReport(row.report),
      url: companyUrlFromCustomization(
        (row.job_description as string | null) ?? null,
        row.report,
        { company }
      ),
      filename: row.filename as string,
      createdAt: row.created_at as string,
    };
  });
}

function collectSearchUrls(result: {
  text?: string;
  sources?: unknown[];
  steps?: Array<{ toolResults?: Array<{ output?: unknown }> }>;
}): string[] {
  const urls = new Set<string>();
  const push = (raw: string | null | undefined) => {
    const url = raw?.trim();
    if (url && /^https?:\/\//i.test(url)) urls.add(url.replace(/[.,;]+$/, ""));
  };
  const fromText = (result.text ?? "").match(/https?:\/\/[^\s)>\]"']+/g) ?? [];
  for (const url of fromText) push(url);
  for (const s of result.sources ?? []) {
    push((s as { url?: string }).url);
  }
  for (const step of result.steps ?? []) {
    for (const tr of step.toolResults ?? []) {
      const output = tr.output as { results?: Array<{ url?: string }> } | undefined;
      for (const hit of output?.results ?? []) push(hit.url);
    }
  }
  return [...urls];
}

async function searchWebForCompanyUrl(
  company: string,
  jobDescription?: string | null
): Promise<string[]> {
  const excerpt = (jobDescription ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
  const result = await generateText({
    model: gateway("anthropic/claude-sonnet-4-6"),
    tools: {
      perplexity_search: gateway.tools.perplexitySearch({
        maxResults: 8,
        searchLanguageFilter: ["en"],
        country: "US",
      }),
    },
    stopWhen: stepCountIs(5),
    maxOutputTokens: 250,
    system: `Find the company's official website homepage (example: https://acme.com/).
Use perplexity_search. Search for "{company} official website".
Return ONLY that homepage URL.
Never return job postings, Greenhouse, Lever, Ashby, Workday, LinkedIn, Indeed, Wikipedia, Crunchbase, or news articles.
If the excerpt already contains the company site, use that.
If you cannot find the official site, respond with exactly NONE.`,
    prompt: [
      `Company: ${company}`,
      excerpt ? `Text that may already include the site:\n${excerpt}` : "",
      `Return the official homepage URL for ${company}.`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return collectSearchUrls(result);
}

export async function findCompanyUrl(input: {
  company: string;
  customizationId?: string;
}): Promise<FindCompanyUrlResult> {
  let company = input.company?.trim() || "";
  let jobDescription: string | null = null;
  let report: unknown = null;

  if (input.customizationId && hasConfig()) {
    const sb = createServiceRoleClient();
    const { data } = await sb
      .from("resume_customizations")
      .select("company,job_description,report")
      .eq("id", input.customizationId)
      .maybeSingle();
    if (data) {
      company = company || ((data.company as string | null) ?? "");
      jobDescription = (data.job_description as string | null) ?? null;
      report = data.report;
    }
  }

  if (!company) return { ok: false, error: "No company to search for." };

  const ctx: CompanyUrlContext = { company };
  const fromJd = companyUrlFromCustomization(jobDescription, report, ctx);
  const known = pickBestCompanyUrl([fromJd], ctx);
  if (known && known.score >= 50) {
    return { ok: true, url: known.url, source: "job_description" };
  }

  try {
    const searched = await searchWebForCompanyUrl(company, jobDescription);
    const ranked = pickBestCompanyUrl([known?.url, ...searched], ctx);
    if (ranked) {
      const source: CompanyUrlSource =
        known && ranked.url === known.url ? "job_description" : "web_search";
      return { ok: true, url: ranked.url, source };
    }
  } catch (err) {
    if (known) return { ok: true, url: known.url, source: "job_description" };
    console.error("[resume-applications.findCompanyUrl]", err);
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "Web search failed — paste the company URL manually.";
    return { ok: false, error: message };
  }

  if (known) return { ok: true, url: known.url, source: "job_description" };
  return { ok: false, error: "Couldn't find the company website. Paste the URL." };
}

export async function markResumeApplicationLogged(
  customizationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!customizationId) return { ok: false, error: "customizationId is required." };
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("resume_customizations")
    .update({ nyui_logged_at: new Date().toISOString() })
    .eq("id", customizationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/nyui");
  revalidatePath("/resume-customizer");
  return { ok: true };
}

export async function dismissResumeApplication(
  customizationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!customizationId) return { ok: false, error: "customizationId is required." };
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("resume_customizations")
    .update({ nyui_dismissed_at: new Date().toISOString() })
    .eq("id", customizationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/nyui");
  return { ok: true };
}
