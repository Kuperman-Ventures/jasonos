"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BrowningNetworkingPage, HandoffRecord } from "@/lib/browning-networking/types";
import { gmailComposeUrl, schedulingDraft } from "@/lib/browning-networking/draft";
import { addCalendarDays } from "@/lib/browning-networking/slots";
import { TRACY_EMAIL, type HandoffSlot } from "@/lib/browning-networking/types";
import { CADENCE_LABELS, type CadenceInterval } from "@/lib/outreach/types";
import {
  checkBrowningHandoffs,
  dismissHandoff,
  draftThankYouFromNotes,
  openHandoffReply,
  saveHandoffSlots,
  setHandoffCadence,
} from "@/lib/server-actions/browning-networking";
import { SlotCalendar, mondayOf } from "./slot-calendar";

const CADENCES: CadenceInterval[] = ["biweekly", "triweekly", "monthly", "quarterly", "none"];

export function BrowningNetworkingClient({
  page,
  initialId,
}: {
  page: BrowningNetworkingPage;
  initialId?: string;
}) {
  const [selectedId, setSelectedId] = useState(
    initialId && page.handoffs.some((row) => row.id === initialId)
      ? initialId
      : page.handoffs[0]?.id ?? ""
  );
  const selected = page.handoffs.find((row) => row.id === selectedId) ?? null;
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-heading text-xl font-semibold">Browning Networking</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Tracy&apos;s handoff emails. You reply to each one the same way. Nothing sends on its own.
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await checkBrowningHandoffs();
              if (!result.ok) toast.error(result.error);
              else if (result.created === 0) toast("No new handoffs.");
              else toast(`Added ${result.created} handoff${result.created === 1 ? "" : "s"}.`);
            })
          }
        >
          Check for new handoffs
        </Button>
        {page.error ? <p className="text-xs text-red-400">{page.error}</p> : null}
        <ul className="space-y-1">
          {page.handoffs.length === 0 ? (
            <li className="rounded-md border border-dashed px-3 py-6 text-xs text-muted-foreground">
              No handoffs yet. The weekday morning check looks for Tracy&apos;s copy-you email.
            </li>
          ) : null}
          {page.handoffs.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={`w-full rounded-md border px-3 py-2 text-left ${
                  row.id === selectedId ? "border-foreground bg-muted" : "border-transparent hover:bg-muted/60"
                }`}
              >
                <div className="text-sm font-medium">{row.contactName || "Unparsed contact"}</div>
                <div className="text-[11px] text-muted-foreground">{statusLabel(row)}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {selected ? (
        <HandoffDetail
          key={selected.id}
          handoff={selected}
          busy={page.busy}
          eligibleYmd={page.eligibleYmd}
        />
      ) : (
        <div />
      )}
    </div>
  );
}

function HandoffDetail({
  handoff,
  busy,
  eligibleYmd,
}: {
  handoff: HandoffRecord;
  busy: BrowningNetworkingPage["busy"];
  eligibleYmd: string;
}) {
  const [slots, setSlots] = useState<HandoffSlot[]>(handoff.slots);
  const [weekMonday, setWeekMonday] = useState(mondayOf(eligibleYmd));
  const [notes, setNotes] = useState("");
  const [cadence, setCadence] = useState<CadenceInterval>("none");
  const [pending, start] = useTransition();
  const draft = useMemo(
    () => schedulingDraft({ name: handoff.contactName, slots }),
    [handoff.contactName, slots]
  );

  function persist(next: HandoffSlot[]) {
    setSlots(next);
    start(async () => {
      const result = await saveHandoffSlots(handoff.id, next);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{handoff.contactName || "Unparsed contact"}</h2>
          <p className="text-xs text-muted-foreground">
            {[handoff.contactTitle, handoff.contactCompany].filter(Boolean).join(" at ") ||
              "Job networking call"}
            {handoff.contactEmail ? ` · ${handoff.contactEmail}` : ""}
            {handoff.contactPhone ? ` · ${handoff.contactPhone}` : ""}
          </p>
          {handoff.linkedinUrl ? (
            <a className="text-xs underline" href={handoff.linkedinUrl} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            start(async () => {
              const result = await dismissHandoff(handoff.id);
              if (!result.ok) toast.error(result.error);
            })
          }
        >
          Dismiss
        </Button>
      </header>

      {handoff.existingContactId ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          This person is already in your contacts. This page will not change that record.
        </p>
      ) : null}
      {handoff.availabilityNote ? (
        <p className="text-sm">They said: {handoff.availabilityNote}</p>
      ) : null}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Times you can offer</h3>
            <p className="text-xs text-muted-foreground">
              Amber blocks are the times in the reply. Gray is already on your calendar. Nothing before{" "}
              {eligibleYmd}. Click an open spot to add a time. Drag a time to move it. The X removes it.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Previous week" onClick={() => setWeekMonday(addCalendarDays(weekMonday, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWeekMonday(mondayOf(eligibleYmd))}>
              First open week
            </Button>
            <Button size="icon" variant="ghost" aria-label="Next week" onClick={() => setWeekMonday(addCalendarDays(weekMonday, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <SlotCalendar
          key={slots.map((slot) => `${slot.id}:${slot.start}`).join("|")}
          slots={slots}
          busy={busy}
          eligibleYmd={eligibleYmd}
          weekMonday={weekMonday}
          onChange={persist}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Reply</h3>
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{draft}</pre>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending || slots.length === 0 || !handoff.contactEmail}
            onClick={() =>
              start(async () => {
                const result = await openHandoffReply(handoff.id, slots);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                window.open(result.url, "_blank", "noopener,noreferrer");
                toast(
                  result.savedInGmail
                    ? "Draft saved in Gmail. It is not sent."
                    : "Opened in Gmail. It is not sent."
                );
              })
            }
          >
            Open reply in Gmail
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const url = handoff.contactEmail
                ? gmailComposeUrl({
                    to: handoff.contactEmail,
                    cc: TRACY_EMAIL,
                    subject: handoff.subject ? `Re: ${handoff.subject.replace(/^re:\s*/i, "")}` : "Re: Executive Networking",
                    body: draft,
                    accountEmail: handoff.gmailAccount,
                  })
                : "";
              void navigator.clipboard.writeText(draft);
              if (url) window.open(url, "_blank", "noopener,noreferrer");
              toast("Reply copied. Tracy is copied on the Gmail window.");
            }}
          >
            Copy reply
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Tracy is copied. Google&apos;s connection can read mail. If it cannot save a draft, this opens the reply ready for you to send.
        </p>
      </section>

      {handoff.brief ? (
        <section className="space-y-2 rounded-md border p-3">
          <h3 className="text-sm font-semibold">
            Brief{handoff.callStartsAt ? ` · ${handoff.callTitle || "Call"}` : ""}
          </h3>
          <BriefLine label="Who they are" text={handoff.brief.who} />
          <BriefLine label="Why they said yes" text={handoff.brief.why} />
          <BriefLine label="Where you overlap" text={handoff.brief.overlap} />
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Questions</div>
            <ol className="list-decimal pl-4 text-sm">
              {handoff.brief.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </div>
          <BriefLine label="Ask them for" text={handoff.brief.ask} />
        </section>
      ) : handoff.callStartsAt ? (
        <p className="text-xs text-muted-foreground">
          The one-page brief shows up the morning of the call, once it is on your calendar.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          A call counts as booked when this person shows up on your calendar. The morning of that call, the brief is here and on your queue.
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">After the call</h3>
        {handoff.thankYouBody ? (
          <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{handoff.thankYouBody}</pre>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Paste the Granola or Fireflies notes and this writes a thank-you draft. The morning check also looks for a transcript. Nothing sends.
            </p>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="w-full rounded-md border bg-background p-2 text-sm"
              placeholder="What they said, and what you offered to do."
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await draftThankYouFromNotes(handoff.id, notes);
                  if (!result.ok) toast.error(result.error);
                  else toast("Thank-you draft is ready. It is not sent.");
                })
              }
            >
              Write thank-you draft
            </Button>
          </>
        )}
        {handoff.createdContactId ? (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <label className="text-xs text-muted-foreground" htmlFor="cadence">
              Keep in touch
            </label>
            <select
              id="cadence"
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={cadence}
              onChange={(event) => setCadence(event.target.value as CadenceInterval)}
            >
              {CADENCES.map((value) => (
                <option key={value} value={value}>
                  {value === "none" ? "No cadence" : CADENCE_LABELS[value]}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await setHandoffCadence(handoff.id, cadence);
                  if (!result.ok) toast.error(result.error);
                  else toast(cadence === "none" ? "No cadence set." : "Cadence saved.");
                })
              }
            >
              Save
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function BriefLine({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function statusLabel(row: HandoffRecord): string {
  if (row.status === "thank_you_ready") return "Thank-you draft ready";
  if (row.status === "brief_ready") return "Brief ready";
  if (row.callStartsAt) return "On your calendar";
  if (row.status === "draft_ready") return "Reply ready";
  if (row.existingContactId) return "Already a contact";
  return "Pick times";
}
