import type { ReactNode } from "react";
import { linkify } from "@/lib/meeting-prep/context-model";
import type { MeetingPrepDetail } from "@/lib/server-actions/meeting-prep";

export function easternClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function joinHref(prep: MeetingPrepDetail): string | null {
  if (prep.conferenceUrl) return prep.conferenceUrl;
  if (prep.location && /^https?:/i.test(prep.location.trim())) return prep.location.trim();
  return null;
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:/i.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="font-semibold text-[var(--color-accent-700)] hover:underline"
    >
      {children}
    </a>
  );
}

export function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {linkify(text).map((part, index) =>
        part.href ? (
          <ExternalLink key={`${part.href}-${index}`} href={part.href}>
            {part.text}
          </ExternalLink>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}

export function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
      {children}
    </h2>
  );
}
