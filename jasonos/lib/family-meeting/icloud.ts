import "server-only";

export interface ICloudCalendarConnection {
  appleId: string;
  appPassword: string;
}

type ConnectionConfig = {
  apple_id?: string;
  access_token?: string;
  api_key?: string;
};

type ConnectionRow = {
  user_id?: string | null;
  status?: string | null;
  config?: ConnectionConfig | null;
  updated_at?: string | null;
};

function fromConfig(cfg: ConnectionConfig | null | undefined): ICloudCalendarConnection | null {
  const appleId = cfg?.apple_id?.trim();
  const appPassword = (cfg?.access_token ?? cfg?.api_key)?.trim();
  if (!appleId || !appPassword) return null;
  return { appleId, appPassword };
}

/** Settings → iCloud Calendar first. Owner row wins when several Auth users share the project. */
export async function resolveICloudCalendarConnection(): Promise<ICloudCalendarConnection | null> {
  try {
    const { createPublicServiceRoleClient } = await import("@/lib/supabase/server");
    const sb = createPublicServiceRoleClient();
    const { data } = await sb
      .from("service_connections")
      .select("user_id, status, config, updated_at")
      .eq("service_name", "icloud_calendar")
      .order("updated_at", { ascending: false });

    const rows = ((data ?? []) as ConnectionRow[])
      .map((row) => ({
        userId: row.user_id ?? null,
        status: row.status ?? null,
        creds: fromConfig(row.config),
      }))
      .filter(
        (row): row is { userId: string | null; status: string | null; creds: ICloudCalendarConnection } =>
          Boolean(row.creds)
      );

    if (!rows.length) return null;

    let ownerId: string | null = null;
    try {
      const { resolveJasonosOwnerUserId } = await import("@/lib/integrations/owner");
      ownerId = await resolveJasonosOwnerUserId();
    } catch {
      ownerId = null;
    }

    const ownerHit = ownerId ? rows.find((row) => row.userId === ownerId) : null;
    if (ownerHit) return ownerHit.creds;
    const connected = rows.find((row) => row.status === "connected");
    return (connected ?? rows[0])!.creds;
  } catch {
    return null;
  }
}

export function maskAppleId(appleId: string): string {
  const at = appleId.indexOf("@");
  if (at <= 1) return "***";
  return `${appleId.slice(0, 2)}…${appleId.slice(at)}`;
}
