import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "jasonos" }, auth: { persistSession: false } }
);

async function outlookToken() {
  const { data } = await sb
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("provider", "outlook")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.refresh_token && !data?.access_token) return null;
  const expires = data.expires_at ? Date.parse(data.expires_at) : 0;
  if (data.access_token && expires - Date.now() > 60_000) return data.access_token;

  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    refresh_token: data.refresh_token,
    grant_type: "refresh_token",
    scope:
      "openid profile email offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read",
  });
  const res = await fetch(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }
  );
  const json = await res.json();
  if (!json.access_token) {
    console.error("refresh failed", json.error || res.status);
    return null;
  }
  return json.access_token;
}

async function downloadResume(token, messageId, nameHint) {
  const list = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments?$top=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!list.ok) {
    console.error("list attachments", list.status, await list.text());
    return null;
  }
  const files = (await list.json()).value ?? [];
  const resumes = files.filter((item) =>
    /\.pdf|\.docx|wordprocessingml|pdf/i.test(`${item.name ?? ""} ${item.contentType ?? ""}`)
  );
  const needle = String(nameHint ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .pop()
    ?.toLowerCase();
  const named =
    needle && needle.length >= 3
      ? resumes.find((item) => String(item.name ?? "")
          .toLowerCase()
          .includes(needle))
      : null;
  const file = named || resumes[0];
  if (!file) return null;
  if (file.contentBytes) {
    return { filename: file.name || "resume.pdf", bytes: Buffer.from(file.contentBytes, "base64") };
  }
  const one = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(file.id)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!one.ok) return null;
  const full = await one.json();
  if (!full.contentBytes) return null;
  return { filename: file.name || "resume.pdf", bytes: Buffer.from(full.contentBytes, "base64") };
}

const { data: rows, error } = await sb
  .from("browning_handoffs")
  .select("id, contact_name, resume_message_id, resume_filename, resume_storage_path")
  .not("resume_message_id", "is", null)
  .is("resume_storage_path", null)
  .neq("status", "dismissed")
  .order("call_starts_at", { ascending: true, nullsFirst: false })
  .limit(20);
if (error) throw error;

const token = await outlookToken();
console.log("outlook token", Boolean(token), "candidates", rows?.length ?? 0);
if (!token) process.exit(1);

for (const row of rows ?? []) {
  const file = await downloadResume(token, row.resume_message_id, row.contact_name);
  console.log(row.contact_name, file ? `${file.filename} ${file.bytes.length}b` : "NO FILE");
  if (!file) {
    // Empty string = tried, mail gone — hourly backfill skips these.
    await sb
      .from("browning_handoffs")
      .update({ resume_storage_path: "" })
      .eq("id", row.id)
      .is("resume_storage_path", null);
    continue;
  }
  const path = `browning/${row.id}/${(file.filename || "resume.pdf").replace(/[^\w.\- ()]+/g, "")}`;
  const { error: upError } = await sb.storage.from("resumes").upload(path, file.bytes, {
    contentType: file.filename.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: true,
  });
  if (upError) {
    console.error("upload", upError);
    continue;
  }
  await sb
    .from("browning_handoffs")
    .update({
      resume_storage_path: path,
      resume_filename: row.resume_filename || file.filename,
    })
    .eq("id", row.id);
  console.log("stored", path);
}
