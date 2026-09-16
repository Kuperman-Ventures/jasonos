import type { HealthStatus, ServiceStatus } from "./services";

export type GoogleMailboxHealth = "connected" | "expired" | "not_connected";

export interface GoogleMailboxSnapshot {
  label: string;
  connected: boolean;
  needsReconnect: boolean;
  error: string | null;
}

export interface GoogleOauthSummary {
  status: ServiceStatus;
  health_status: HealthStatus;
  health_details: string;
  error_message: string | null;
  success: boolean;
}

export function googleMailboxHealth(
  mailbox: Pick<GoogleMailboxSnapshot, "connected" | "needsReconnect">
): GoogleMailboxHealth {
  if (!mailbox.connected) return "not_connected";
  if (mailbox.needsReconnect) return "expired";
  return "connected";
}

export function mailboxStatusLine(mailbox: GoogleMailboxSnapshot): string {
  const health = googleMailboxHealth(mailbox);
  if (health === "expired") {
    return mailbox.error ?? `${mailbox.label}: sign-in expired. Reconnect in Settings.`;
  }
  if (health === "connected") return `${mailbox.label}: connected`;
  return `${mailbox.label}: not connected`;
}

export function summarizeGoogleMailboxes(
  mailboxes: GoogleMailboxSnapshot[]
): GoogleOauthSummary {
  const expired = mailboxes.filter((mailbox) => googleMailboxHealth(mailbox) === "expired");
  const connected = mailboxes.filter((mailbox) => googleMailboxHealth(mailbox) === "connected");
  const missing = mailboxes.filter((mailbox) => googleMailboxHealth(mailbox) === "not_connected");
  const health_details = mailboxes.map(mailboxStatusLine).join(" · ");

  if (expired.length === 0 && missing.length === 0) {
    return {
      status: "connected",
      health_status: "healthy",
      health_details,
      error_message: null,
      success: true,
    };
  }

  if (expired.length > 0) {
    return {
      status: "expired",
      health_status: connected.length > 0 ? "degraded" : "down",
      health_details,
      error_message: expired.map(mailboxStatusLine).join(" · "),
      success: false,
    };
  }

  return {
    status: "not_configured",
    health_status: "down",
    health_details,
    error_message: missing.map(mailboxStatusLine).join(" · "),
    success: false,
  };
}

export function overlayGoogleOauthOntoServices<
  T extends {
    service_name: string;
    status: ServiceStatus;
    health_status: HealthStatus | null;
    health_details: string | null;
    error_message: string | null;
  },
>(
  services: T[],
  google: {
    advisorsConnected: boolean;
    gmailConnected: boolean;
    advisorsNeedsReconnect: boolean;
    gmailNeedsReconnect: boolean;
    advisorsError: string | null;
    gmailError: string | null;
  }
): T[] {
  const summary = summarizeGoogleMailboxes([
    {
      label: "Advisors Google",
      connected: google.advisorsConnected,
      needsReconnect: google.advisorsNeedsReconnect,
      error: google.advisorsError,
    },
    {
      label: "Personal Gmail",
      connected: google.gmailConnected,
      needsReconnect: google.gmailNeedsReconnect,
      error: google.gmailError,
    },
  ]);

  return services.map((service) => {
    if (service.service_name !== "gmail" && service.service_name !== "google_calendar") {
      return service;
    }
    return {
      ...service,
      status: summary.status,
      health_status: summary.health_status,
      health_details: summary.health_details,
      error_message: summary.error_message,
    };
  });
}
