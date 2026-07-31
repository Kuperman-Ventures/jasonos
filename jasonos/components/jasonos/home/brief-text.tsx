import type { ReactNode } from "react";
import { normalizeGmailUrl } from "@/lib/integrations/gmail-links";

// Renders brief prose with clickable links. Supports markdown links
// `[label](https://…)` and bare `https://…` URLs. Used across Morning Brief
// structured sections (email, newsletters, calendar, attention). Gmail links
// are normalized so they open the specific thread in the right mailbox.

type Piece =
  | { type: "text"; value: string }
  | { type: "link"; label: string; href: string };

const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const BARE_URL = /(https?:\/\/[^\s<>"'`)\]}]+)/g;

function tokenize(input: string): Piece[] {
  const pieces: Piece[] = [];
  let i = 0;
  const re = new RegExp(
    `${MD_LINK.source}|${BARE_URL.source}`,
    "g"
  );

  for (const match of input.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > i) {
      pieces.push({ type: "text", value: input.slice(i, start) });
    }
    if (match[1] && match[2]) {
      pieces.push({
        type: "link",
        label: match[1],
        href: normalizeGmailUrl(match[2]),
      });
    } else if (match[3]) {
      const raw = match[3].replace(/[.,;:!?]+$/, "");
      pieces.push({ type: "link", label: raw, href: normalizeGmailUrl(raw) });
    }
    i = start + match[0].length;
  }
  if (i < input.length) {
    pieces.push({ type: "text", value: input.slice(i) });
  }
  return pieces.length ? pieces : [{ type: "text", value: input }];
}

const linkClass =
  "font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200 hover:decoration-sky-300";

export function BriefText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const pieces = tokenize(text);
  const nodes: ReactNode[] = pieces.map((p, idx) => {
    if (p.type === "text") return <span key={idx}>{p.value}</span>;
    return (
      <a
        key={idx}
        href={p.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {p.label}
      </a>
    );
  });
  return <span className={className}>{nodes}</span>;
}
