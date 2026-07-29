import {
  AlertTriangle,
  CalendarDays,
  Inbox,
  Newspaper,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPublishedMorningBrief } from "@/lib/data/morning-brief";
import {
  parseMorningBrief,
  type EmailGroup,
  type ParsedMorningBrief,
} from "@/lib/data/parse-morning-brief";

// Intercepts Claude's published markdown and lays it out as scannable
// sections that match the rest of Home — attention first, then calendar,
// email groups, newsletter digest. Falls back to raw markdown if the brief
// has no ## structure we recognize.

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

function signalTone(meta: string | null): "hot" | "cool" | "mute" | "ok" {
  if (!meta) return "ok";
  const m = meta.toLowerCase();
  if (m.includes("high signal") || m.includes("action")) return "hot";
  if (m.includes("none") || m.includes("noise")) return "mute";
  if (m.includes("unread") || m.includes("bulk")) return "cool";
  return "ok";
}

function SignalBadge({ meta }: { meta: string }) {
  const tone = signalTone(meta);
  const cls =
    tone === "hot"
      ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
      : tone === "mute"
        ? "border-border bg-muted/40 text-muted-foreground"
        : tone === "cool"
          ? "border-sky-400/30 bg-sky-500/10 text-sky-200"
          : "border-border bg-background/60 text-muted-foreground";
  return (
    <span
      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none ${cls}`}
    >
      {meta}
    </span>
  );
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

function AttentionBlock({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3">
      <SectionLabel icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}>
        Needs your attention
      </SectionLabel>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-snug">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-semibold tabular-nums text-amber-200">
              {i + 1}
            </span>
            <span className="text-foreground/90">{item}</span>
          </li>
        ))}
      </ol>
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
    <div>
      <SectionLabel icon={<CalendarDays className="h-3.5 w-3.5" />}>
        Calendar today
      </SectionLabel>
      {items.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border bg-background/40">
          {items.map((ev, i) => (
            <li
              key={i}
              className="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-2.5 text-sm sm:grid-cols-[8.5rem_1fr]"
            >
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-sky-200/90">
                {ev.time || "—"}
              </span>
              <span className="min-w-0 leading-snug text-foreground/90">{ev.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? (
        <p className="mt-2 rounded-md border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[12px] leading-snug text-amber-100/90">
          <span className="font-semibold text-amber-200">Conflict · </span>
          {note.replace(/^conflict:\s*/i, "")}
        </p>
      ) : null}
    </div>
  );
}

function EmailGroupCard({ group }: { group: EmailGroup }) {
  const empty =
    !group.body &&
    group.bullets.length === 0 &&
    (group.meta?.toLowerCase().includes("none") ?? false);

  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold tracking-tight">{group.title}</h4>
        {group.meta ? <SignalBadge meta={group.meta} /> : null}
      </div>
      {empty ? (
        <p className="text-[12px] italic text-muted-foreground">Nothing in this bucket.</p>
      ) : (
        <>
          {group.body
            ? group.body.split(/\n\n+/).map((para, i) => (
                <p
                  key={i}
                  className="mb-1.5 text-[13px] leading-relaxed text-foreground/85 last:mb-0"
                >
                  {para}
                </p>
              ))
            : null}
          {group.bullets.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {group.bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] leading-snug text-foreground/85"
                >
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/70" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

function EmailBlock({
  intro,
  groups,
}: {
  intro: string | null;
  groups: EmailGroup[];
}) {
  if (groups.length === 0 && !intro) return null;
  return (
    <div>
      <SectionLabel icon={<Inbox className="h-3.5 w-3.5" />} hint={intro}>
        Email by group
      </SectionLabel>
      <div className="grid gap-2 md:grid-cols-2">
        {groups.map((g, i) => (
          <EmailGroupCard key={`${g.title}-${i}`} group={g} />
        ))}
      </div>
    </div>
  );
}

function NewsletterBlock({
  groups,
}: {
  groups: ParsedMorningBrief["newsletters"];
}) {
  if (groups.length === 0) return null;
  return (
    <div>
      <SectionLabel icon={<Sparkles className="h-3.5 w-3.5" />}>
        Newsletter digest
      </SectionLabel>
      <div className="grid gap-3 md:grid-cols-3">
        {groups.map((g, i) => (
          <div
            key={`${g.title}-${i}`}
            className="rounded-lg border bg-background/40 p-3"
          >
            <h4 className="mb-2 text-[12px] font-semibold tracking-tight">
              {g.title}
            </h4>
            <ul className="space-y-1.5">
              {g.items.map((item, j) => (
                <li
                  key={j}
                  className="flex gap-2 text-[12px] leading-snug text-foreground/80"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400/70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
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

function StructuredBrief({ parsed }: { parsed: ParsedMorningBrief }) {
  return (
    <div className="space-y-5 px-4 py-4">
      <AttentionBlock items={parsed.attention} />
      <CalendarBlock items={parsed.calendar} note={parsed.calendarNote} />
      <EmailBlock intro={parsed.emailIntro} groups={parsed.emailGroups} />
      <NewsletterBlock groups={parsed.newsletters} />
      {parsed.extras.map((ex, i) => (
        <ExtraBlock key={`${ex.title}-${i}`} title={ex.title} bodyMd={ex.bodyMd} />
      ))}
      {parsed.footer ? (
        <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {parsed.footer}
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

export async function MorningBriefCard() {
  const brief = await getPublishedMorningBrief();
  const parsed = brief ? parseMorningBrief(brief.contentMd) : null;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Newspaper className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight">Morning Brief</h2>
        {brief ? (
          brief.isStale ? (
            <span className="ml-auto text-[11px] text-amber-300/90">
              as of {formatAsOf(brief.briefDate)}
            </span>
          ) : (
            <span className="ml-auto text-[11px] text-muted-foreground">
              {formatTodayLabel(brief.briefDate)}
            </span>
          )
        ) : null}
      </div>

      {!brief || !parsed ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No brief yet
        </p>
      ) : parsed.structured ? (
        <div className="max-h-[640px] overflow-y-auto">
          <StructuredBrief parsed={parsed} />
        </div>
      ) : (
        <RawMarkdownFallback md={brief.contentMd} />
      )}
    </section>
  );
}
