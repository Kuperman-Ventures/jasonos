"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Play } from "@phosphor-icons/react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  CollapsibleSection,
  LIVE_SECTION_LABEL,
  UnfinishedField,
} from "@/components/jasonos/live";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AfterTheCall } from "@/components/jasonos/meeting-prep/after-call";
import { PointsEditor } from "@/components/jasonos/meeting-prep/points-editor";
import { ExternalLink } from "@/components/jasonos/meeting-prep/meeting-prep-bits";
import {
  AdaptedPlan,
  AttendeeResearch,
  Expandable,
  GoalLinks,
  MEETING_PREP_FIELD,
  PersonRow,
  ThreadRow,
} from "@/components/jasonos/meeting-prep/meeting-prep-client";
import {
  collapseText,
  easternDateLong,
  type MeetingContext,
  type MeetingContextPerson,
} from "@/lib/meeting-prep/context-model";
import { isJoinBoilerplate } from "@/lib/meeting-prep/text";
import { buildMeetingPlan, recheckMeetingWho } from "@/lib/server-actions/meeting-plan";
import {
  createMeetingPoint,
  deleteMeetingPoint,
  draftMeetingPointReactions,
  draftMeetingPoints,
  reorderMeetingPoints,
  updateMeetingPoint,
  type MeetingPoint,
} from "@/lib/server-actions/meeting-points";
import {
  setMeetingOutcomeSentence,
  type MeetingPrepDetail,
  type ProjectPickerOption,
} from "@/lib/server-actions/meeting-prep";
import { saveMeetingPointsAsScript, type LiveScript, type MeetingAdaptation } from "@/lib/server-actions/live-scripts";
import type { MeetingReview } from "@/lib/server-actions/meeting-reviews";
import { cn } from "@/lib/utils";

type StepKey = "who" | "what" | "plan" | "how";

const STEPS: { key: StepKey; num: number; label: string; anchor: string }[] = [
  { key: "who", num: 1, label: "Who", anchor: "step-who" },
  { key: "what", num: 2, label: "What", anchor: "step-what" },
  { key: "plan", num: 3, label: "Plan", anchor: "step-plan" },
  { key: "how", num: 4, label: "How it went", anchor: "step-how" },
];

function stepComplete(key: StepKey, prep: MeetingPrepDetail, markableCount: number): boolean {
  switch (key) {
    case "who":
      return Boolean(prep.researchRanAt);
    case "what":
      return Boolean(prep.outcomeSentence?.trim());
    case "plan":
      return markableCount > 0;
    case "how":
      return Boolean(prep.liveEndedAt);
    default:
      return false;
  }
}

function currentStep(prep: MeetingPrepDetail, markableCount: number): StepKey {
  for (const step of STEPS) {
    if (!stepComplete(step.key, prep, markableCount)) return step.key;
  }
  return "how";
}

function StepStrip({
  prep,
  markableCount,
}: {
  prep: MeetingPrepDetail;
  markableCount: number;
}) {
  const active = currentStep(prep, markableCount);
  const liveEnded = Boolean(prep.liveEndedAt);

  return (
    <nav
      aria-label="Meeting prep steps"
      className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-[var(--jos-ink)] px-10 py-3 text-[14px]"
    >
      {STEPS.map((step, index) => {
        const done = stepComplete(step.key, prep, markableCount);
        const isActive = step.key === active;
        const howLocked = step.key === "how" && !liveEnded;
        return (
          <span key={step.key} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <span className="mx-1 text-[var(--jos-muted)]" aria-hidden>·</span>
            ) : null}
            <button
              type="button"
              disabled={howLocked}
              className={cn(
                "inline-flex flex-col items-start rounded-[2px] px-1 py-0.5 text-left sm:flex-row sm:items-baseline sm:gap-1.5",
                howLocked && "cursor-not-allowed opacity-45",
                isActive && !howLocked && "bg-[var(--jos-surface)]",
                !howLocked && "hover:underline"
              )}
              onClick={() => {
                if (howLocked) return;
                document.getElementById(step.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span
                className={cn(
                  "font-bold tabular-nums",
                  done ? "text-[var(--color-done)]" : isActive ? "text-[var(--jos-ink)]" : "text-[var(--jos-muted)]"
                )}
              >
                {step.num}
              </span>
              <span className={cn("font-semibold", isActive ? "text-[var(--jos-ink)]" : "text-[var(--jos-muted)]")}>
                {step.label}
              </span>
              {howLocked ? (
                <span className="text-[12px] font-medium text-[var(--jos-muted)]">after the call</span>
              ) : null}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

function StepSection({
  id,
  title,
  stepNum,
  complete,
  children,
}: {
  id: string;
  title: string;
  stepNum: number;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[calc(var(--jos-nav-h)+4rem)] border-b border-[var(--jos-line)] py-10">
      <div className="mb-6 flex flex-wrap items-baseline gap-3">
        <span
          className={cn(
            "flex size-8 items-center justify-center text-[14px] font-bold",
            complete ? "bg-[var(--color-done-100)] text-[var(--color-done)]" : "bg-[var(--jos-surface)] text-[var(--jos-ink)]"
          )}
        >
          {stepNum}
        </span>
        <h2 className="text-[28px] font-extrabold tracking-tight">{title}</h2>
        {complete ? (
          <CheckCircle size={22} weight="duotone" className="text-[var(--color-done)]" aria-label="Complete" />
        ) : null}
      </div>
      {children}
    </section>
  );
}

function researchStatusLine(prep: MeetingPrepDetail, people: MeetingContextPerson[]): string {
  const personBits: string[] = [];
  if (prep.researchUnverified) {
    personBits.push("Person research unverified");
  } else if (prep.researchRanAt) {
    personBits.push("Person research verified");
  }
  const companyUnverified = people.some((person) => person.companyResearch && !person.companyResearch.verified);
  if (companyUnverified) {
    personBits.push("Company info unverified");
  } else if (people.some((person) => person.companyResearch?.verified)) {
    personBits.push("Company info verified");
  }
  return personBits.join(" · ") || (prep.researchRanAt ? "Research complete" : "Research not run yet");
}

function planProvenanceLine(prep: MeetingPrepDetail): string | null {
  if (prep.handoffId) {
    return "Built from the Browning first-call playbook and their resume. Edit anything.";
  }
  const source = prep.planSource?.trim();
  const named = prep.scriptName?.trim() || null;
  const guideName = named?.replace(/^From plan:\s*/i, "").trim() || null;
  const playbookName = prep.adaptedFromScriptName?.trim() || named;
  if (source === "playbook" && playbookName) return `Built from ${playbookName}`;
  if (source === "playbook") return "Built from a playbook";
  if (source === "guide" && guideName) return `Built from guide: ${guideName}`;
  if (source === "guide") return "Built from a guide";
  if (source === "blank") return "Written from what JasonOS knew";
  if (source === "chat") return "Written in chat";
  return null;
}

type BuildFromValue = "" | `playbook:${string}` | `guide:${string}`;

function parseBuildFrom(value: BuildFromValue): { kind: "playbook" | "guide" | "blank"; scriptId?: string } {
  if (value.startsWith("playbook:")) {
    return { kind: "playbook", scriptId: value.slice("playbook:".length) };
  }
  if (value.startsWith("guide:")) {
    return { kind: "guide", scriptId: value.slice("guide:".length) };
  }
  return { kind: "blank" };
}

const BUILD_PHASES = ["Checking who they are", "Reading the email thread", "Writing the plan"] as const;

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = collapseText(a)?.toLowerCase();
  const right = collapseText(b)?.toLowerCase();
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function PlanStep({
  prep,
  points,
  pointsError,
  scripts,
  people,
  adaptation,
}: {
  prep: MeetingPrepDetail;
  points: MeetingPoint[];
  pointsError?: string | null;
  scripts: LiveScript[];
  people: MeetingContextPerson[];
  adaptation: MeetingAdaptation | null;
}) {
  const router = useRouter();
  const markable = points.filter((point) => point.kind !== "agenda");
  const asks = markable.filter((point) => point.kind === "ask");
  const asksMissing = asks.filter((point) => point.reactions.length !== 6);
  const reactionsReady = asks.length > 0 && asksMissing.length === 0;

  const signature = adaptation ? `${adaptation.id}:${adaptation.updatedAt}` : "";
  const [seenAdaptation, setSeenAdaptation] = useState(signature);
  const [proposal, setProposal] = useState<MeetingAdaptation | null>(adaptation);
  if (signature !== seenAdaptation) {
    setSeenAdaptation(signature);
    setProposal(adaptation);
  }

  const [showBuild, setShowBuild] = useState(markable.length === 0 && !proposal);
  const [buildFrom, setBuildFrom] = useState<BuildFromValue>("");
  const [building, setBuilding] = useState(false);
  const [buildPhase, setBuildPhase] = useState<string | null>(null);
  const [contextUsed, setContextUsed] = useState<string[]>([]);
  const [contextMissing, setContextMissing] = useState<string[]>([]);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const personName =
    prep.primaryContactName ||
    people.find((person) => person.contactId === prep.primaryContactId)?.name ||
    people[0]?.name ||
    "This person";

  const playbookOptions = scripts.filter((script) => script.kind !== "plan");
  const guideOptions = scripts.filter((script) => script.kind === "plan" && !script.attachedPrepId);

  const runBuild = async () => {
    const from = parseBuildFrom(buildFrom);
    if ((from.kind === "playbook" || from.kind === "guide") && !from.scriptId) {
      toast.error(from.kind === "playbook" ? "Pick a playbook." : "Pick a guide.");
      return;
    }
    setBuilding(true);
    let phaseIndex = 0;
    setBuildPhase(BUILD_PHASES[0]);
    const phaseTimer = window.setInterval(() => {
      phaseIndex = Math.min(phaseIndex + 1, BUILD_PHASES.length - 1);
      setBuildPhase(BUILD_PHASES[phaseIndex]);
    }, 2200);
    try {
      const result = await buildMeetingPlan({
        prepId: prep.id,
        from: { kind: from.kind, scriptId: from.scriptId ?? null },
      });
      window.clearInterval(phaseTimer);
      setBuilding(false);
      setBuildPhase(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setContextUsed(result.contextUsed);
      setContextMissing(result.contextMissing);
      if (result.proposal) {
        setProposal(result.proposal);
        setShowBuild(false);
        toast.success("Plan ready to review");
        return;
      }
      if (result.written) {
        toast.success(
          result.written.added === 1 ? "Added 1 point" : `Added ${result.written.added} points`
        );
        setShowBuild(false);
        router.refresh();
      }
    } catch (err) {
      window.clearInterval(phaseTimer);
      setBuilding(false);
      setBuildPhase(null);
      toast.error(err instanceof Error ? err.message : "Build failed");
    }
  };

  const openRebuild = () => {
    if (markable.length > 0) {
      setConfirmRebuild(true);
      return;
    }
    setShowBuild(true);
  };

  const saveScript = () => {
    const name = saveName.trim();
    if (!name) {
      toast.error("Name the playbook.");
      return;
    }
    setSaving(true);
    void saveMeetingPointsAsScript({
      prepId: prep.id,
      name,
      description: saveDescription,
    }).then((result) => {
      setSaving(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaveOpen(false);
      setSaveName("");
      setSaveDescription("");
      toast.success(
        <span>
          Saved as playbook.{" "}
          <a className="underline" href={`/live/scripts/${result.scriptId}`}>
            Open it
          </a>
        </span>
      );
    });
  };

  const provenance = planProvenanceLine(prep);
  const usedLine =
    proposal?.contextUsed?.length ? proposal.contextUsed : contextUsed;
  const missingLine =
    proposal?.contextMissing?.length ? proposal.contextMissing : contextMissing;

  const buildPanel =
    showBuild || (markable.length === 0 && !proposal) ? (
      <div className="space-y-4 rounded-[2px] border border-[var(--color-neutral-400)] bg-[var(--jos-surface)] p-5">
        <h3 className="text-[18px] font-bold">Build plan</h3>
        <label className="block max-w-md space-y-1">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            Start from
          </span>
          <select
            value={buildFrom}
            className="w-full border-0 border-b-2 border-[var(--color-neutral-400)] bg-transparent py-1 text-[15px] outline-none"
            onChange={(event) => setBuildFrom(event.target.value as BuildFromValue)}
          >
            {playbookOptions.map((script) => (
              <option key={script.id} value={`playbook:${script.id}`}>
                {script.name}
              </option>
            ))}
            {guideOptions.map((script) => (
              <option key={script.id} value={`guide:${script.id}`}>
                Guide: {script.name}
              </option>
            ))}
            <option value="">Nothing, write from what JasonOS knows</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="default" disabled={building} onClick={() => void runBuild()}>
            Build
          </Button>
          {building && buildPhase ? (
            <span className="text-[14px] text-[var(--jos-muted)]">{buildPhase}</span>
          ) : null}
        </div>
        {usedLine.length || missingLine.length ? (
          <div className="text-[13px] text-[var(--jos-muted)]">
            {usedLine.length ? <p>Used: {usedLine.join(" · ")}</p> : null}
            {missingLine.length ? <p>Missing: {missingLine.join(" · ")}</p> : null}
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      {proposal ? (
        <AdaptedPlan
          proposal={proposal}
          personName={personName}
          pointCount={points.length}
          onClose={() => setProposal(null)}
        />
      ) : null}

      {!proposal && markable.length === 0 ? buildPanel : null}

      {markable.length > 0 && !proposal ? (
        <>
          {provenance ? <p className="text-[14px] text-[var(--jos-muted)]">{provenance}</p> : null}
          {(usedLine.length > 0 || missingLine.length > 0) && !showBuild ? (
            <div className="text-[13px] text-[var(--jos-muted)]">
              {usedLine.length ? <p>Used: {usedLine.join(" · ")}</p> : null}
              {missingLine.length ? <p>Missing: {missingLine.join(" · ")}</p> : null}
            </div>
          ) : null}

          {showBuild ? buildPanel : null}

          <p className="flex flex-wrap items-center gap-2 text-[14px] text-[var(--jos-muted)]">
            <span>
              {markable.length} points · {asks.length} asks
              {reactionsReady ? " · reactions ready" : ""}
            </span>
            {reactionsReady ? (
              <CheckCircle size={16} weight="duotone" className="text-[var(--color-done)]" aria-hidden />
            ) : asksMissing.length ? (
              <span className="rounded-[2px] bg-[var(--jos-warn-tint)] px-2 py-0.5 text-[13px] font-semibold text-[var(--jos-ink)]">
                {asksMissing.length === 1
                  ? "1 ask has no reactions"
                  : `${asksMissing.length} asks have no reactions`}
              </span>
            ) : null}
          </p>

          <PointsEditor
            layout="outline"
            points={points}
            error={pointsError}
            selectedId={selectedPointId}
            onSelectedIdChange={setSelectedPointId}
            actions={{
              create: async (input) => {
                const result = await createMeetingPoint({ prepId: prep.id, ...input });
                if (!result.ok) return result;
                return { ok: true, id: result.point.id };
              },
              update: (id, patch) => updateMeetingPoint(id, patch),
              draftReactions: (id) => draftMeetingPointReactions(id),
              remove: (id) => deleteMeetingPoint(id),
              reorder: (ids) => reorderMeetingPoints(prep.id, ids),
            }}
            draft={{ label: "Add more with AI", run: () => draftMeetingPoints(prep.id) }}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/meetings/${prep.id}/live`}
              className={cn(buttonVariants({ variant: "default" }), "h-12 gap-2 px-5 text-[15px]")}
            >
              <Play size={18} weight="fill" aria-hidden />
              Start live
            </Link>
            {confirmRebuild ? (
              <span className="text-[14px]">
                Replace your current points?{" "}
                <button
                  type="button"
                  className="font-semibold text-[var(--color-accent-700)] hover:underline"
                  onClick={() => {
                    setConfirmRebuild(false);
                    setShowBuild(true);
                  }}
                >
                  Continue
                </button>
                {" · "}
                <button type="button" className="font-semibold hover:underline" onClick={() => setConfirmRebuild(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <Button type="button" size="sm" variant="secondary" onClick={openRebuild}>
                Rebuild
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" onClick={() => setSaveOpen(true)}>
              Save as playbook
            </Button>
          </div>
        </>
      ) : null}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as playbook</DialogTitle>
            <DialogDescription>
              Copies these points into a playbook. State and notes stay on this meeting.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveScript();
            }}
          >
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">
                Name <span className="text-[var(--jos-danger)]">*</span>
              </span>
              <input
                required
                value={saveName}
                maxLength={120}
                className={`${MEETING_PREP_FIELD} h-11`}
                onChange={(event) => setSaveName(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Description</span>
              <textarea
                value={saveDescription}
                rows={3}
                className={`${MEETING_PREP_FIELD} py-2`}
                onChange={(event) => setSaveDescription(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={saving}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MeetingOnePath({
  prep,
  context,
  points,
  pointsError,
  scripts,
  rubric,
  review,
  projects,
  adaptation,
  onAddUnmatched,
}: {
  prep: MeetingPrepDetail;
  context: MeetingContext;
  points: MeetingPoint[];
  pointsError?: string | null;
  scripts: LiveScript[];
  rubric: string[];
  review: MeetingReview | null;
  projects: ProjectPickerOption[];
  adaptation: MeetingAdaptation | null;
  onAddUnmatched: (person: { email: string; name: string | null }) => void;
}) {
  const router = useRouter();
  const [, startRecheck] = useTransition();
  const [showAllThreads, setShowAllThreads] = useState(false);
  const markableCount = useMemo(() => points.filter((point) => point.kind !== "agenda").length, [points]);

  const briefing = context.briefing;
  const visibleThreads = showAllThreads ? briefing.otherThreads : briefing.otherThreads.slice(0, 4);
  const hiddenThreadCount = briefing.otherThreads.length - visibleThreads.length;

  const standBody =
    context.recentEmail &&
    briefing.whereItStands &&
    sameText(context.recentEmail.summary, briefing.whereItStands.text) &&
    context.recentEmail.summary.length > briefing.whereItStands.text.length + 40
      ? context.recentEmail.summary
      : undefined;
  const emailIsNew =
    Boolean(context.recentEmail) &&
    !sameText(context.recentEmail?.summary, standBody ?? briefing.whereItStands?.text) &&
    !sameText(context.recentEmail?.summary, briefing.introduction?.text) &&
    !sameText(context.recentEmail?.summary, briefing.yourStake?.text);

  const purpose = isJoinBoilerplate(prep.purpose) ? "" : (prep.purpose ?? "").trim();

  const commitments = context.brief.commitments.map((item) => ({
    text: item.text,
    direction: item.direction,
    due: item.due,
    personName: item.personName,
    status: item.status,
  }));

  const recheck = () => {
    startRecheck(async () => {
      const result = await recheckMeetingWho(prep.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.errors.length && result.researched.length === 0) {
        toast.error(result.errors[0]);
      } else if (result.researched.length) {
        toast.success(`Updated research for ${result.researched.join(", ")}`);
      } else {
        toast.success("Research and email context refreshed");
      }
      router.refresh();
    });
  };

  return (
    <>
      <StepStrip prep={prep} markableCount={markableCount} />
      <div className="px-10 pb-16">
        <StepSection
          id="step-who"
          title="Who"
          stepNum={1}
          complete={stepComplete("who", prep, markableCount)}
        >
          <ul className="max-w-3xl">
            {context.people.map((person) => (
              <PersonRow key={person.contactId} person={person} />
            ))}
            {context.unmatched.map((person) => (
              <li key={person.email} className="border-t border-[var(--jos-line)] py-4">
                <p className="text-[18px] font-semibold">{person.name || person.email}</p>
                <button
                  type="button"
                  className="mt-1 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
                  onClick={() => onAddUnmatched({ email: person.email, name: person.name })}
                >
                  Add to contacts
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 max-w-3xl">
            <AttendeeResearch people={context.people} />
          </div>

          <p className="mt-4 text-[14px] text-[var(--jos-muted)]">{researchStatusLine(prep, context.people)}</p>

          <div className="mt-4">
            <Button type="button" variant="secondary" size="sm" onClick={recheck}>
              Re-check
            </Button>
          </div>

          <div className="mt-8 max-w-3xl">
            <p className={LIVE_SECTION_LABEL}>How this meeting came about</p>
            {prep.emailContext ? (
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{prep.emailContext}</p>
            ) : (
              <p className="mt-2 text-[14px] text-[var(--jos-muted)]">No email context yet.</p>
            )}
          </div>

          <CollapsibleSection
            id={`${prep.id}-more-history`}
            label="More history"
            defaultOpen={false}
            className="mt-10 max-w-3xl"
          >
            <div className="space-y-5">
              <CollapsibleSection
                id={`${prep.id}-earlier-meetings`}
                label="Earlier meetings"
                meta={context.pastMeetings.length || undefined}
                defaultOpen={false}
              >
                {context.pastMeetings.length ? (
                  <ul className="space-y-4">
                    {context.pastMeetings.map((meeting) => (
                      <li key={meeting.id}>
                        <p className="text-[13px] font-semibold text-[var(--jos-muted)]">
                          {meeting.when ? easternDateLong(meeting.when) : "Past meeting"}
                        </p>
                        {meeting.title ? <p className="text-[15px] font-semibold">{meeting.title}</p> : null}
                        {meeting.nextStep ? (
                          <p className="mt-1 text-[14px]">
                            <span className="font-semibold">Next. </span>
                            {meeting.nextStep}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] text-[var(--jos-muted)]">No earlier meetings on file.</p>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                id={`${prep.id}-email`}
                label="Latest email"
                meta={briefing.otherThreads.length || undefined}
                defaultOpen={false}
              >
                {emailIsNew && context.recentEmail ? (
                  <div className="space-y-2">
                    <p className="text-[13px] font-semibold text-[var(--jos-muted)]">
                      With {context.recentEmail.personName}
                    </p>
                    <Expandable text={context.recentEmail.summary} />
                    {context.recentEmail.threadUrl ? (
                      <ExternalLink href={context.recentEmail.threadUrl}>Open email</ExternalLink>
                    ) : null}
                  </div>
                ) : briefing.otherThreads.length ? (
                  <ul>
                    {visibleThreads.map((thread) => (
                      <ThreadRow key={thread.id} thread={thread} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] text-[var(--jos-muted)]">No recent email.</p>
                )}
                {hiddenThreadCount > 0 ? (
                  <button
                    type="button"
                    className="mt-2 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
                    onClick={() => setShowAllThreads(true)}
                  >
                    {hiddenThreadCount} earlier threads
                  </button>
                ) : null}
              </CollapsibleSection>

              <CollapsibleSection
                id={`${prep.id}-docs`}
                label="Documents"
                meta={context.documents.length || undefined}
                defaultOpen={false}
              >
                {context.documents.length ? (
                  <ul className="space-y-3 text-[15px]">
                    {context.documents.map((document) => (
                      <li key={document.id}>
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          {document.url ? (
                            <ExternalLink href={document.url}>{document.label}</ExternalLink>
                          ) : (
                            <span className="font-semibold">{document.label}</span>
                          )}
                          {document.sourceType ? (
                            <span className="text-[12px] text-[var(--jos-muted)]">{document.sourceType}</span>
                          ) : null}
                        </div>
                        {document.snippet ? (
                          <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-[var(--jos-muted)]">
                            {document.snippet}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] text-[var(--jos-muted)]">No documents linked.</p>
                )}
              </CollapsibleSection>

              {context.jobSearch.length ? (
                <CollapsibleSection id={`${prep.id}-jobs`} label="Job search" defaultOpen={false}>
                  <ul className="space-y-2">
                    {context.jobSearch.map((job) => (
                      <li key={`${job.kind}-${job.id}`} className="text-[15px]">
                        <Link href={job.href} className="font-semibold text-[var(--color-accent-700)] hover:underline">
                          {job.title}
                          {job.company ? ` · ${job.company}` : ""}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
              ) : null}
            </div>
          </CollapsibleSection>
        </StepSection>

        <StepSection
          id="step-what"
          title="What"
          stepNum={2}
          complete={stepComplete("what", prep, markableCount)}
        >
          <div className="max-w-3xl space-y-4">
            <p className={LIVE_SECTION_LABEL}>Outcome for this meeting</p>
            <UnfinishedField
              value={prep.outcomeSentence ?? ""}
              emptyLabel="One sentence you will score this meeting against"
              placeholder="One sentence you will score this meeting against"
              inputClassName="text-[22px] font-semibold leading-snug"
              onSave={(next) => {
                void setMeetingOutcomeSentence(prep.id, next).then((result) => {
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Outcome saved");
                  router.refresh();
                });
              }}
            />
            {!prep.outcomeSentence?.trim() && purpose ? (
              <button
                type="button"
                className="text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
                onClick={() => {
                  void setMeetingOutcomeSentence(prep.id, purpose).then((result) => {
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Outcome saved from purpose");
                    router.refresh();
                  });
                }}
              >
                Use purpose
              </button>
            ) : null}
            <GoalLinks prep={prep} projects={projects} people={context.people} showCompany={false} />
          </div>
        </StepSection>

        <StepSection
          id="step-plan"
          title="Plan"
          stepNum={3}
          complete={stepComplete("plan", prep, markableCount)}
        >
          <PlanStep
            prep={prep}
            points={points}
            pointsError={pointsError}
            scripts={scripts}
            people={context.people}
            adaptation={adaptation}
          />
        </StepSection>

        <StepSection
          id="step-how"
          title="How it went"
          stepNum={4}
          complete={stepComplete("how", prep, markableCount)}
        >
          {prep.liveEndedAt ? (
            <AfterTheCall
              prep={prep}
              points={points}
              rubric={rubric}
              review={review}
              commitments={commitments}
              nextTouch={null}
            />
          ) : (
            <p className="max-w-xl text-[15px] text-[var(--jos-muted)]">
              Available after you go live and end the call.
            </p>
          )}
        </StepSection>
      </div>
    </>
  );
}
