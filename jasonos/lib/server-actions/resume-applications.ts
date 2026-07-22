"use server";

// Bridge between Custom Communications and NYUI: every customized resume is a
// job application. This exposes the "to log" queue (customizations not yet
// logged as an NYS DOL work search) with company / URL / role pre-extracted,
// and marks a customization logged once it's added to NYUI.

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface ResumeApplication {
  customizationId: string;
  company: string | null;
  roleTitle: string | null;
  url: string | null;
  filename: string;
  createdAt: string;
}

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// First http(s) URL in the job description, if the pasted/uploaded JD carried
// an application link.
function extractUrl(jd: string | null): string | null {
  if (!jd) return null;
  const m = jd.match(/https?:\/\/[^\s)>\]"']+/);
  return m ? m[0].replace(/[.,;]+$/, "") : null;
}

export async function getResumeApplicationQueue(): Promise<ResumeApplication[]> {
  if (!hasConfig()) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("resume_customizations")
    .select("id,company,filename,job_description,report,created_at,nyui_logged_at")
    .is("nyui_logged_at", null)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    console.error("[resume-applications.getResumeApplicationQueue]", error);
    return [];
  }
  return (data ?? []).map((row) => {
    const report = (row.report ?? {}) as { analysis?: { roleTitle?: string } };
    return {
      customizationId: row.id as string,
      company: (row.company as string | null) ?? null,
      roleTitle: report.analysis?.roleTitle ?? null,
      url: extractUrl((row.job_description as string | null) ?? null),
      filename: row.filename as string,
      createdAt: row.created_at as string,
    };
  });
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
