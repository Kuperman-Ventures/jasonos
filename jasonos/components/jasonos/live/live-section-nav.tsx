import Link from "next/link";
import { cn } from "@/lib/utils";

type Section = "meetings" | "decks" | "playbooks";

const LINKS: Array<{ id: Section; label: string; href: string }> = [
  { id: "meetings", label: "Meetings", href: "/live" },
  { id: "decks", label: "Decks", href: "/live/decks" },
  { id: "playbooks", label: "Playbooks", href: "/live/playbooks" },
];

export function LiveSectionNav({ current }: { current: Section }) {
  return (
    <nav aria-label="Live sections" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
      {LINKS.map((link) =>
        link.id === current ? (
          <span key={link.id} className="font-semibold text-[var(--jos-ink)]">
            {link.label}
          </span>
        ) : (
          <Link
            key={link.id}
            href={link.href}
            className={cn("text-[var(--jos-muted)] hover:text-[var(--jos-ink)] hover:underline")}
          >
            {link.label}
          </Link>
        )
      )}
    </nav>
  );
}
