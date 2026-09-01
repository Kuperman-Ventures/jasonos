import type { ReactNode } from "react";
import { normalizeGmailUrl } from "@/lib/integrations/gmail-links";
import { tokenizeBriefText } from "@/lib/data/brief-links";
import {
  isAllowedBriefHref,
  type BriefLinkKind,
} from "@/lib/data/brief-outbound";

// Renders brief prose with clickable links. Supports markdown links
// `[label](https://…)` and bare `https://…` URLs. Used across Morning Brief
// structured sections (email, newsletters, calendar, attention). Gmail links
// are normalized so they open the specific thread in the right mailbox.
// Google Calendar `eid` values may contain a space; those become `%20` so the
// event title stays the link and the raw URL never prints.
//
// URLs we cannot match to an article / email / calendar / meeting (newsletter
// issue landings, Google error/redirect pages, Gmail without a thread id)
// render as plain text — no hyperlink.

const linkClass =
  "font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200 hover:decoration-sky-300";

export function BriefText({
  text,
  className,
  allow,
}: {
  text: string;
  className?: string;
  /** Restrict which destinations stay clickable. Default: any trusted kind. */
  allow?: readonly BriefLinkKind[];
}) {
  const pieces = tokenizeBriefText(text);
  const nodes: ReactNode[] = pieces.map((p, idx) => {
    if (p.type === "text") return <span key={idx}>{p.value}</span>;
    if (!isAllowedBriefHref(p.href, allow)) {
      return <span key={idx}>{p.label}</span>;
    }
    return (
      <a
        key={idx}
        href={normalizeGmailUrl(p.href)}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {p.label}
      </a>
    );
  });
  return (
    <span
      className={["break-words [overflow-wrap:anywhere]", className]
        .filter(Boolean)
        .join(" ")}
    >
      {nodes}
    </span>
  );
}
