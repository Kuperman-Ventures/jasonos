import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * /meetings/[id] → linked Slides when present, else /live.
 * Before migration 0114, decks does not exist — fall through to /live.
 */
export default async function MeetingPrepRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect("/live");
  }

  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .select("id")
      .eq("kind", "slides")
      .eq("meeting_prep_id", id)
      .maybeSingle();
    if (!error && data?.id) {
      redirect(`/live/slides/${data.id}`);
    }
  } catch {
    // decks not migrated yet
  }

  redirect("/live");
}
