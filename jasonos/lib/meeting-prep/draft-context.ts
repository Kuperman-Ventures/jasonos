import type { MeetingContext } from "./context-model";
import { draftContextLines, type DraftPromptInput } from "./points";
import { isJoinBoilerplate } from "./text";
import { TRACKS, type Track } from "@/lib/types";

export function meetingTrack(
  stored: string | null | undefined,
  people: Array<{ tracks?: string[] }>
): Track | null {
  if (stored && (TRACKS as string[]).includes(stored)) return stored as Track;
  for (const person of people) {
    const track = person.tracks?.find((item): item is Track => (TRACKS as string[]).includes(item));
    if (track) return track;
  }
  return null;
}

export interface DraftMeetingSource {
  title: string;
  purpose: string | null;
  outcomeSentence: string | null;
  projectGoal: string | null;
  personalGoal: string | null;
  attendees: Array<{ email: string; name: string | null }>;
  emailContext?: string | null;
  track?: string | null;
}

/** The person context Draft and Adapt both send. */
export function assembleDraftPrompt(
  prep: DraftMeetingSource,
  context: MeetingContext,
  narratives: Array<{ title: string; body: string }> = []
): { input: DraftPromptInput; contextUsed: string[]; contextMissing: string[] } {
  const purpose = prep.purpose && !isJoinBoilerplate(prep.purpose) ? prep.purpose : null;
  const person = context.people[0] ?? null;
  const referrer =
    context.people.find((item) => item.referredByName?.trim())?.referredByName?.trim() ||
    context.connections.find((item) => item.who?.trim())?.who?.trim() ||
    null;
  const personalGoal = person?.personalGoal?.trim() || null;
  const openCommitments = context.brief.commitments
    .filter((item) => item.status === "open")
    .map((item) => ({
      text: item.text,
      direction: item.direction,
      due: item.due,
      personName: item.personName,
    }));
  const granolaSummaries = [
    ...context.pastMeetings
      .filter((meeting) => meeting.granolaSummary?.trim())
      .map((meeting) => ({
        title: meeting.title,
        date: meeting.when,
        summary: meeting.granolaSummary!.trim().slice(0, 1500),
        sort: meeting.when ? Date.parse(meeting.when) : 0,
      })),
    ...context.granolaNotes
      .filter((note) => note.summary.trim())
      .map((note) => ({
        title: note.title,
        date: note.when,
        summary: note.summary.trim().slice(0, 1500),
        sort: note.when ? Date.parse(note.when) : 0,
      })),
  ]
    .sort((a, b) => (Number.isNaN(b.sort) ? 0 : b.sort) - (Number.isNaN(a.sort) ? 0 : a.sort))
    .filter((note, index, list) => list.findIndex((item) => item.summary === note.summary) === index)
    .slice(0, 3)
    .map(({ title, date, summary }) => ({ title, date, summary }));
  const lastNextStep =
    context.pastMeetings.find((meeting) => meeting.nextStep?.trim())?.nextStep?.trim() || null;
  const relationshipGoal = prep.personalGoal || personalGoal;
  const track = meetingTrack(prep.track, context.people);
  const packet = person?.packet ?? null;
  const lines = draftContextLines({
    purpose,
    outcomeSentence: prep.outcomeSentence,
    relationshipBrief: context.brief.summary,
    openCommitments: openCommitments.length,
    referrer,
    personalGoal,
    projectGoal: prep.projectGoal,
    relationshipGoal,
    granolaNotes: granolaSummaries.length,
    earlierMeetings: context.pastMeetings.length,
    jobSearch: context.jobSearch.length,
    personResearch: context.people.some(
      (item) => item.researchLead || item.researchBullets.length
    ),
    companyResearch: context.people.some(
      (item) => item.companyResearch?.lead || item.companyResearch?.bullets.length
    ),
    emailContext: prep.emailContext ?? null,
    narrativeCount: narratives.filter((item) => item.body.trim()).length,
    packet: Boolean(packet),
    requirePacket: track === "job_search",
  });
  const knownEmails = new Set(context.people.map((item) => item.email.toLowerCase()));
  const attendees = [
    ...context.people.map((item) => ({
      name: item.name,
      title: item.title,
      company: item.company,
      personResearch:
        item.researchLead || item.researchBullets.length
          ? { lead: item.researchLead, bullets: item.researchBullets.slice(0, 4) }
          : null,
      companyResearch: item.companyResearch
        ? {
            name: item.companyResearch.name,
            lead: item.companyResearch.lead,
            bullets: item.companyResearch.bullets.slice(0, 4),
            verified: item.companyResearch.verified,
          }
        : null,
    })),
    ...prep.attendees
      .filter((attendee) => !knownEmails.has(attendee.email.toLowerCase()))
      .map((attendee) => ({
        name: attendee.name || attendee.email,
        title: null,
        company: null,
        personResearch: null,
        companyResearch: null,
      })),
  ];
  return {
    ...lines,
    input: {
      title: prep.title,
      attendees,
      purpose,
      outcomeSentence: prep.outcomeSentence,
      summary: context.brief.summary,
      nextMove: context.brief.nextMove,
      openCommitments,
      topics: context.brief.topics,
      whereItStands: context.briefing.whereItStands?.text ?? null,
      yourStake: context.briefing.yourStake?.text ?? null,
      introduction: context.briefing.introduction?.text ?? null,
      referrer,
      personalGoal,
      projectGoal: prep.projectGoal,
      relationshipGoal,
      lastNextStep,
      granolaSummaries,
      pastMeetings: context.pastMeetings.map((meeting) => ({
        title: meeting.title,
        debriefNotes: meeting.debriefNotes,
        nextStep: meeting.nextStep,
      })),
      jobSearch: context.jobSearch.map((job) => ({
        title: job.title,
        company: job.company,
        kind: job.kind,
      })),
      emailContext: prep.emailContext?.trim() || null,
      narratives: narratives.filter((item) => item.body.trim()),
      track,
      linkedinUrl: person?.linkedinUrl ?? null,
      browningPrep: person?.browningPrep ?? null,
      packet,
    },
  };
}
