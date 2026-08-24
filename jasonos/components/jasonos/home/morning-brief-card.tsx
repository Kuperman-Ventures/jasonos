import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getPublishedMorningBrief,
  type PublishedMorningBrief,
} from "@/lib/data/morning-brief";
import { etToday } from "@/lib/dates";
import {
  parseMorningBrief,
  type ParsedMorningBrief,
} from "@/lib/data/parse-morning-brief";
import { MorningBriefAttention } from "@/components/jasonos/home/morning-brief-attention";
import { BriefText } from "@/components/jasonos/home/brief-text";
import { MorningBriefCollapse } from "@/components/jasonos/home/morning-brief-collapse";
import { NewsletterDigest } from "@/components/jasonos/home/newsletter-digest";

// Intercepts Claude's published markdown and lays it out as scannable
// sections that match the rest of Home — attention first, then calendar,
// newsletter digest. Falls back to raw markdown if the brief has no ##
// structure we recognize.

function formatAsOf(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatTodayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole calendar days between two YYYY-MM-DD strings (b - a). */
function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / 86_400_000);
}

function stalenessLabel(days: number): string {
  if (days <= 0) return "";
  if (days === 1) return "1 day old";
  return `${days} days old`;
}

/** Link back to today's brief (clears the ?brief param). */
const TODAY_HREF = "/";

function briefHref(date: string): string {
  return `/?brief=${date}`;
}

function SectionLabel({
  icon,
  children,
  hint,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string | null;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
          {children}
        </h3>
      </div>
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

function CalendarBlock({
  items,
  note,
}: {
  items: ParsedMorningBrief["calendar"];
  note: string | null;
}) {
  if (items.length === 0 && !note) return null;
  return (
    <div className="min-w-0">
      <SectionLabel icon={<CalendarDays className="h-3.5 w-3.5" />}>
        Calendar today
      </SectionLabel>
      {items.length > 0 ? (
        <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-lg border bg-background/40">
          {items.map((ev, i) => (
            <li key={i} className="flex min-w-0 items-start gap-3 px-3 py-2.5">
              <span className="w-[7.25rem] shrink-0 pt-0.5 text-[12px] font-medium tabular-nums leading-snug text-sky-200/90 sm:w-[8.5rem]">
                {ev.time || "—"}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5 [overflow-wrap:anywhere]">
                {ev.title ? (
                  <div className="text-[13px] font-medium leading-snug text-foreground">
                    <BriefText text={ev.title} />
                  </div>
                ) : null}
                {ev.text ? (
                  <div className="text-[13px] leading-snug text-foreground/85">
                    <BriefText text={ev.text} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? (
        /conflict/i.test(note) ? (
          <p className="mt-2 min-w-0 rounded-md border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[12px] leading-snug text-amber-100/90 [overflow-wrap:anywhere]">
            <span className="font-semibold text-amber-200">Conflict · </span>
            <BriefText text={note.replace(/^conflict:\s*/i, "")} />
          </p>
        ) : (
          <p className="mt-2 min-w-0 text-[12px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
            <BriefText text={note} />
          </p>
        )
      ) : null}
    </div>
  );
}

function NewsletterBlock({
  groups,
}: {
  groups: ParsedMorningBrief["newsletters"];
}) {
  if (!groups.some((g) => g.stories.length > 0)) return null;
  return (
    <div>
      <SectionLabel icon={<Sparkles className="h-3.5 w-3.5" />}>
        Newsletter digest
      </SectionLabel>
      <NewsletterDigest groups={groups} />
    </div>
  );
}

function ExtraBlock({ title, bodyMd }: { title: string; bodyMd: string }) {
  return (
    <div>
      <SectionLabel icon={<Newspaper className="h-3.5 w-3.5" />}>{title}</SectionLabel>
      <div className="rounded-lg border bg-background/40 px-3 py-2 text-[13px] leading-relaxed text-foreground/85">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => (
              <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
          }}
        >
          {bodyMd}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function StructuredBrief({
  parsed,
  briefDate,
}: {
  parsed: ParsedMorningBrief;
  briefDate: string;
}) {
  return (
    <div className="space-y-5 px-4 py-4 min-w-0">
      <MorningBriefAttention briefDate={briefDate} items={parsed.attention} />
      <CalendarBlock items={parsed.calendar} note={parsed.calendarNote} />
      <NewsletterBlock groups={parsed.newsletters} />
      {parsed.extras.map((ex, i) => (
        <ExtraBlock key={`${ex.title}-${i}`} title={ex.title} bodyMd={ex.bodyMd} />
      ))}
      {parsed.footer ? (
        <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          <BriefText text={parsed.footer} />
        </p>
      ) : null}
    </div>
  );
}

function RawMarkdownFallback({ md }: { md: string }) {
  return (
    <div className="max-h-[520px] overflow-y-auto px-4 py-3 text-sm leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="mb-2 mt-3 text-base font-semibold tracking-tight first:mt-0">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-2 mt-3 text-sm font-semibold tracking-tight first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

function DayNav({ brief }: { brief: PublishedMorningBrief }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t bg-background/40 px-4 py-2">
      {brief.prevDate ? (
        <Link
          href={briefHref(brief.prevDate)}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {formatAsOf(brief.prevDate)}
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[11px] text-muted-foreground/40">
          <ChevronLeft className="h-3.5 w-3.5" />
          Earliest
        </span>
      )}

      {brief.isStale ? (
        <Link
          href={TODAY_HREF}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-sky-300 transition-colors hover:text-sky-200"
        >
          Jump to latest
        </Link>
      ) : (
        <span className="text-[11px] text-muted-foreground">Latest brief</span>
      )}

      {brief.nextDate ? (
        <Link
          href={briefHref(brief.nextDate)}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          {formatAsOf(brief.nextDate)}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[11px] text-muted-foreground/40">
          Newest
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

export async function MorningBriefCard({
  selectedDate,
}: {
  selectedDate?: string;
}) {
  const brief = await getPublishedMorningBrief(selectedDate);
  const parsed = brief ? parseMorningBrief(brief.contentMd) : null;
  const staleDays = brief?.isStale ? daysBetween(brief.briefDate, etToday()) : 0;

  const header = (
    <>
      <Newspaper className="h-4 w-4 text-muted-foreground" />
      <h2 className="text-sm font-semibold tracking-tight">Morning Brief</h2>
      {brief ? (
        brief.isStale ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-200">
            <AlertTriangle className="h-3 w-3" />
            {formatAsOf(brief.briefDate)}
          </span>
        ) : (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {formatTodayLabel(brief.briefDate)}
          </span>
        )
      ) : null}
    </>
  );

  return (
    <MorningBriefCollapse header={header}>
      {brief?.isStale ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-rose-400/30 bg-rose-500/15 px-4 py-2 text-[12px] leading-snug text-rose-100/90">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
          <span>
            <span className="font-semibold text-rose-200">Out of date · </span>
            Showing {formatTodayLabel(brief.briefDate)}
            {staleDays > 0 ? ` (${stalenessLabel(staleDays)})` : ""}. Today&rsquo;s
            brief hasn&rsquo;t published yet.
          </span>
          <Link
            href={TODAY_HREF}
            className="font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200"
          >
            Back to latest
          </Link>
        </div>
      ) : null}

      {!brief || !parsed ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No brief yet
        </p>
      ) : parsed.structured ? (
        <div className="max-h-[640px] min-w-0 overflow-x-hidden overflow-y-auto">
          <StructuredBrief parsed={parsed} briefDate={brief.briefDate} />
        </div>
      ) : (
        <RawMarkdownFallback md={brief.contentMd} />
      )}

      {brief && (brief.prevDate || brief.nextDate || brief.isStale) ? (
        <DayNav brief={brief} />
      ) : null}
    </MorningBriefCollapse>
  );
}
