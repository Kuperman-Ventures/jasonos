"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BrowningNetworkingPage, HandoffRecord } from "@/lib/browning-networking/types";
import {
  followUpDraft,
  formatSlotLabel,
  replyComposeUrl,
  replySubject,
  schedulingDraft,
} from "@/lib/browning-networking/draft";
import { handoffLane, isFollowUp, type HandoffLane } from "@/lib/browning-networking/lanes";
import { addCalendarDays } from "@/lib/browning-networking/slots";
import { TRACY_EMAIL, type HandoffSlot } from "@/lib/browning-networking/types";
import { CADENCE_LABELS, type CadenceInterval } from "@/lib/outreach/types";
import {
  checkBrowningHandoffs,
  draftThankYouFromNotes,
  pullGranolaThankYou,
  markHandoffActedOn,
  openHandoffReply,
  saveHandoffSlots,
  sendMeetInvite,
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
  const [actedIds, setActedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState(() => {
    const requested = initialId
      ? page.handoffs.find((row) => row.id === initialId)
      : undefined;
    if (requested && handoffLane(requested) !== "waiting") return requested.id;
    return (
      page.handoffs.find((row) => handoffLane(row) === "reply")?.id ??
      page.handoffs.find((row) => handoffLane(row) === "scheduled")?.id ??
      ""
    );
  });
  const laneFor = (row: HandoffRecord): HandoffLane =>
    actedIds.includes(row.id) && handoffLane(row) === "reply" ? "waiting" : handoffLane(row);
  const selected = page.handoffs.find((row) => row.id === selectedId) ?? null;
  const selectedLane = selected ? laneFor(selected) : null;
  const [pending, start] = useTransition();
  const replyRows = page.handoffs.filter((row) => laneFor(row) === "reply");
  const waitingRows = page.handoffs.filter((row) => laneFor(row) === "waiting");
  const scheduledRows = page.handoffs.filter((row) => laneFor(row) === "scheduled");

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-heading text-xl font-semibold">Browning Networking</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Reply, then mark Acted On. The check also looks back a year for intros that never made your calendar. Those can be followed up.
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await checkBrowningHandoffs();
              if (!result.ok) toast.error(result.error);
              else if (result.created === 0 && result.followUps === 0 && result.preps === 0) {
                toast(
                  result.olderFound > 0
                    ? `Found ${result.olderFound} older intros. They already have a meeting or are already on this page.`
                    : "No older Tracy intros found in the last year."
                );
              }
              else {
                const parts = [];
                if (result.created > 0) {
                  parts.push(`Added ${result.created} handoff${result.created === 1 ? "" : "s"}.`);
                }
                if (result.followUps > 0) {
                  parts.push(`Added ${result.followUps} follow-up${result.followUps === 1 ? "" : "s"}.`);
                }
                if (result.preps > 0) {
                  parts.push(
                    `Meeting prep is on ${result.preps} contact${result.preps === 1 ? "" : "s"}, under Meetings.`
                  );
                }
                toast(parts.join(" "));
              }
            })
          }
        >
          Check for new handoffs
        </Button>
        {page.error ? <p className="text-xs text-red-400">{page.error}</p> : null}
        {page.handoffs.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-xs text-muted-foreground">
            No handoffs yet. The check looks in Gmail and Outlook for Tracy&apos;s copy-you email.
          </p>
        ) : (
          <>
            <HandoffLaneList
              title="To reply"
              empty="Nobody left to reply to."
              rows={replyRows}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <HandoffLaneList
              title="Waiting for them to schedule"
              empty="Nobody is waiting yet. Acted On moves someone here after you send."
              rows={waitingRows}
              selectedId={selectedId}
              onSelect={setSelectedId}
              openRow={(row) => isFollowUp(row) || Boolean(row.replyExcerpt)}
              lane="waiting"
            />
            <HandoffLaneList
              title="Meeting set"
              empty="Nobody is on the calendar yet."
              rows={scheduledRows}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </>
        )}
      </aside>
      {selected && selected.replyExcerpt && selectedLane === "waiting" ? (
        <InvitePanel key={selected.id} handoff={selected} />
      ) : selected && isFollowUp(selected) ? (
        <FollowUpPanel key={selected.id} handoff={selected} />
      ) : selected && selectedLane !== "waiting" ? (
        <HandoffDetail
          key={selected.id}
          handoff={selected}
          busy={page.busy}
          eligibleYmd={page.eligibleYmd}
          onActedOn={() => {
            setActedIds((ids) => (ids.includes(selected.id) ? ids : [...ids, selected.id]));
            setSelectedId("");
          }}
        />
      ) : waitingRows.some((row) => isFollowUp(row)) ? (
        <p className="text-sm text-muted-foreground">
          Select a follow-up on the left. Follow Up opens a reply to the last note you sent.
        </p>
      ) : waitingRows.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Waiting for them to schedule. Nothing to send from here.
        </p>
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
  onActedOn,
}: {
  handoff: HandoffRecord;
  busy: BrowningNetworkingPage["busy"];
  eligibleYmd: string;
  onActedOn: () => void;
}) {
  const [slots, setSlots] = useState<HandoffSlot[]>(handoff.slots);
  const [weekMonday, setWeekMonday] = useState(mondayOf(eligibleYmd));
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [cadence, setCadence] = useState<CadenceInterval>("none");
  const [pending, start] = useTransition();
  const meetingSet = handoffLane(handoff) === "scheduled";
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
        {handoffLane(handoff) === "reply" ? (
          <Button
            onClick={() =>
              start(async () => {
                const result = await markHandoffActedOn(handoff.id);
                if (!result.ok) toast.error(result.error);
                else {
                  onActedOn();
                  toast("Acted on. They're in the waiting list until the meeting is on your calendar.");
                }
              })
            }
            disabled={pending}
          >
            Acted On
          </Button>
        ) : null}
      </header>
      {handoff.existingContactId ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          This person is already in your contacts. This page will not change that record.
        </p>
      ) : null}
      {handoff.availabilityNote ? (
        <p className="text-sm">They said: {handoff.availabilityNote}</p>
      ) : null}

      {meetingSet ? (
        <section className="rounded-md border px-3 py-2">
          <h3 className="text-sm font-semibold">Meeting set</h3>
          <p className="text-sm">
            {handoff.callTitle ? `${handoff.callTitle}. ` : ""}
            {handoff.callStartsAt ? formatSlotLabel(handoff.callStartsAt) : "On your calendar."}
          </p>
          <p className="text-xs text-muted-foreground">This time stays as it is.</p>
        </section>
      ) : (
      <>
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
                window.location.href = result.url;
                toast.success("Opening Mail… finish the send there. Tracy is on Bcc.");
              })
            }
          >
            Open reply in Apple Mail
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const url = handoff.contactEmail
                ? replyComposeUrl({
                    to: handoff.contactEmail,
                    bcc: TRACY_EMAIL,
                    subject: replySubject(handoff.subject),
                    body: draft,
                  })
                : "";
              void navigator.clipboard.writeText(draft);
              if (url) {
                window.location.href = url;
                toast.success("Reply copied. Opening Mail… Tracy is on Bcc.");
                return;
              }
              toast.success("Reply copied.");
            }}
          >
            Copy reply
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Tracy is on Bcc. Apple Mail opens with the reply filled in. Nothing sends until you send it.
        </p>
      </section>
      </>
      )}

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
          <>
            <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{handoff.thankYouBody}</pre>
            {handoff.contactEmail ? (
              <Button
                size="sm"
                onClick={() => {
                  window.location.href = replyComposeUrl({
                    to: handoff.contactEmail ?? "",
                    subject: replySubject(handoff.subject),
                    body: handoff.thankYouBody ?? "",
                  });
                  toast.success("Opening Mail… finish the send there.");
                }}
              >
                Open thank-you in Apple Mail
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Get the Granola note for this call. That writes the thank-you. Nothing sends. The morning check does the same after the call.
            </p>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await pullGranolaThankYou(handoff.id);
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast("Thank-you draft is ready from Granola. It is not sent.");
                    router.refresh();
                  }
                })
              }
            >
              Get the Granola note
            </Button>
            <p className="text-xs text-muted-foreground">
              If Granola does not have the note yet, paste it here.
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

function HandoffLaneList({
  title,
  empty,
  rows,
  selectedId,
  onSelect,
  selectable = true,
  openRow,
  lane,
}: {
  title: string;
  empty: string;
  rows: HandoffRecord[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  selectable?: boolean;
  openRow?: (row: HandoffRecord) => boolean;
  lane?: HandoffLane;
}) {
  return (
    <section className="space-y-1">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="ml-1.5 font-normal">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-3 text-[11px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => {
            const open = selectable && (openRow ? openRow(row) : true);
            return (
            <li key={row.id}>
              {open ? (
                <button
                  type="button"
                  onClick={() => onSelect?.(row.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left ${
                    row.id === selectedId ? "border-foreground bg-muted" : "border-transparent hover:bg-muted/60"
                  }`}
                >
                  <HandoffLaneLabel row={row} lane={lane} />
                </button>
              ) : (
                <div className="w-full rounded-md border border-transparent px-3 py-2 text-left">
                  <HandoffLaneLabel row={row} lane={lane} />
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function HandoffLaneLabel({ row, lane }: { row: HandoffRecord; lane?: HandoffLane }) {
  return (
    <>
      <div className="text-sm font-medium">{row.contactName || "Unparsed contact"}</div>
      <div className="text-[11px] text-muted-foreground">{statusLabel(row, lane)}</div>
    </>
  );
}

function FollowUpPanel({ handoff }: { handoff: HandoffRecord }) {
  const body = followUpDraft(handoff.contactName);
  const subject = replySubject(handoff.lastOutreachSubject || handoff.subject);
  const sent = handoff.lastOutreachSentAt
    ? new Date(handoff.lastOutreachSentAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/New_York",
      })
    : null;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{handoff.contactName || "This contact"}</h2>
        <p className="text-xs text-muted-foreground">
          {sent ? `You wrote them ${sent}.` : "You already wrote them."} No meeting is on your calendar.
        </p>
      </header>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Follow up</h3>
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{body}</pre>
        <Button
          disabled={!handoff.contactEmail}
          onClick={() => {
            if (!handoff.contactEmail) return;
            window.location.href = replyComposeUrl({
              to: handoff.contactEmail,
              subject,
              body,
            });
            toast.success("Opening Mail… finish the send there.");
          }}
        >
          Follow Up
        </Button>
        <p className="text-xs text-muted-foreground">
          This replies to the last note you sent. Nothing sends until you send it from Apple Mail.
        </p>
      </section>
    </div>
  );
}

function InvitePanel({ handoff }: { handoff: HandoffRecord }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const offered = [...handoff.slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const preset =
    offered.find(
      (slot) =>
        handoff.chosenSlotStart && Date.parse(slot.start) === Date.parse(handoff.chosenSlotStart)
    )?.start ??
    offered[0]?.start ??
    "";
  const [startIso, setStartIso] = useState(preset ?? "");
  const picked = offered.find((slot) => slot.start === startIso) ?? null;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{handoff.contactName || "This contact"}</h2>
        <p className="text-xs text-muted-foreground">
          They replied. Send a Google Meet invite from jason@kupermanadvisors.com. Google emails it. Apple Mail is not involved.
        </p>
      </header>
      {handoff.replyExcerpt ? (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold">What they wrote</h3>
          <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{handoff.replyExcerpt}</p>
        </section>
      ) : null}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Time for the invite</h3>
        <div className="flex flex-col gap-1">
          {offered.map((slot) => (
            <label key={slot.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`invite-${handoff.id}`}
                checked={slot.start === startIso}
                onChange={() => setStartIso(slot.start)}
              />
              {formatSlotLabel(slot.start)}
            </label>
          ))}
        </div>
        <Button
          disabled={pending || !picked || !handoff.contactEmail}
          onClick={() => {
            if (!picked) return;
            start(async () => {
              const result = await sendMeetInvite(handoff.id, picked.start);
              if (!result.ok) toast.error(result.error);
              else {
                toast.success(`Google is emailing ${handoff.contactName || "them"} the Meet invite.`);
                router.refresh();
              }
            });
          }}
        >
          Send Meet invite
        </Button>
        <p className="text-xs text-muted-foreground">
          If Google says the connection can only read the calendar, reconnect Advisors Google in Settings and allow adding events.
        </p>
      </section>
    </div>
  );
}

function statusLabel(row: HandoffRecord, lane: HandoffLane = handoffLane(row)): string {
  if (row.chosenSlotStart && lane === "waiting") return `Picked ${formatSlotLabel(row.chosenSlotStart)}`;
  if (row.replyExcerpt && lane === "waiting") return "Replied — pick the time";
  if (row.status === "follow_up" && lane !== "scheduled") return "Follow up";
  if (row.status === "thank_you_ready") return "Thank-you draft ready";
  if (row.status === "brief_ready") return "Brief ready";
  if (lane === "scheduled") return "On your calendar";
  if (lane === "waiting") return "Waiting for them to schedule";
  if (row.status === "draft_ready") return "Reply ready";
  return "Pick times";
}
