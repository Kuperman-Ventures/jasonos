import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";

// Lightweight: rebuild meeting_brief from stored resume_text using the same
// sentence-split logic as meeting-brief.ts (kept here so we can run without tsx path issues).

function resumeLines(resumeText) {
  const raw = String(resumeText ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .flatMap((line) => {
      const cleaned = line.replace(/^[\s•·*\-–]+/, "").replace(/\s+/g, " ").trim();
      if (!cleaned) return [];
      if (cleaned.length <= 280) return [cleaned];
      return cleaned
        .split(/(?<=[.!?])\s+|(?<=;)\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
    });
  return raw
    .map((line) => line.replace(/^[\s•·*\-–]+/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 12 && line.length <= 280)
    .filter((line) => !/@/.test(line))
    .filter((line) => !/linkedin\.com/i.test(line));
}

function sentences(value, max) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, max)
    .join(" ");
}

function clip(value, max) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function meetingBrief({ tracyBody, resumeText, whyTheyReplied }) {
  const lines = resumeLines(resumeText);
  let whoParts = [];
  let resumePoints = [];
  if (lines.length) {
    whoParts = [sentences(lines.slice(0, 3).join(" "), 2)].filter(Boolean);
    resumePoints = lines
      .slice(whoParts.length ? 2 : 0)
      .filter((line) => line.length >= 40)
      .slice(0, 4);
  }
  const why = (whyTheyReplied || tracyBody || "").trim();
  const parts = [];
  if (whoParts.length) parts.push(`Who they are\n${clip(whoParts.join(" "), 500)}`);
  if (why) parts.push(`Why Tracy thinks you should talk\n${clip(why, 500)}`);
  if (resumePoints.length) {
    parts.push(`Resume\n${resumePoints.map((line) => `- ${clip(line, 220)}`).join("\n")}`);
  }
  const text = parts.join("\n\n").trim();
  return text.length >= 40 ? text : null;
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "jasonos" }, auth: { persistSession: false } }
);

const ids = process.argv.slice(2);
const query = sb
  .from("browning_handoffs")
  .select(
    "id, contact_name, resume_text, why_they_replied, intro_reason, subject, meeting_brief, created_contact_id, existing_contact_id"
  )
  .not("resume_text", "is", null)
  .neq("status", "dismissed");
const { data: rows, error } = ids.length
  ? await query.in("id", ids)
  : await query
      .gte("call_starts_at", new Date(Date.now() - 7 * 864e5).toISOString())
      .order("call_starts_at", { ascending: true })
      .limit(20);
if (error) throw error;

let wrote = 0;
for (const row of rows ?? []) {
  const brief = meetingBrief({
    tracyBody: row.intro_reason || row.subject || "",
    resumeText: row.resume_text,
    whyTheyReplied: row.why_they_replied,
  });
  if (!brief) continue;
  if (brief === row.meeting_brief) continue;
  console.log(row.contact_name);
  console.log("  before:", String(row.meeting_brief || "").slice(0, 100));
  console.log("  after: ", brief.slice(0, 160).replace(/\n/g, " | "));
  const { error: updateError } = await sb
    .from("browning_handoffs")
    .update({ meeting_brief: brief })
    .eq("id", row.id);
  if (updateError) throw updateError;
  const contactId = row.created_contact_id || row.existing_contact_id;
  if (contactId) {
    await sb.from("contacts").update({ browning_prep: brief }).eq("id", contactId);
  }
  wrote += 1;
}
console.log(`updated ${wrote} briefs`);
