/**
 * Editable guidance for post-meeting Follow Up drafts.
 * Stored on user_preferences.meeting_followup_prompt when Jason overrides
 * the default in Settings → General.
 *
 * Placeholders filled at compose time:
 *   {{firstName}}   — recipient first name, or "Name"
 *   {{greeting}}    — "First," or "Hi,"
 *   {{whenPhrase}}  — "today" / "yesterday" / "last week" / …
 */

/** Max chars of meeting material sent to the draft model. */
export const MEETING_FOLLOWUP_SOURCE_MAX_CHARS = 12_000;

/**
 * Prefer transcript; keep a short notes preface when both exist so the model
 * still sees Granola's structured takeaways without crowding out the talk.
 * Labels match the Network Screen style (plain section headers).
 */
export function buildMeetingFollowupSourceMaterial(input: {
  summary?: string | null;
  transcript?: string | null;
  maxChars?: number;
}): { material: string; usedTranscript: boolean } {
  const maxChars = Math.max(2_000, input.maxChars ?? MEETING_FOLLOWUP_SOURCE_MAX_CHARS);
  const transcript = input.transcript?.trim() || "";
  const summary = input.summary?.trim() || "";
  if (transcript) {
    const notesBudget = summary ? Math.min(1_500, Math.floor(maxChars * 0.12)) : 0;
    const notesPart = summary
      ? `Meeting notes:\n${summary.slice(0, notesBudget)}\n\n`
      : "";
    const label = "Meeting transcript:\n";
    const remaining = Math.max(500, maxChars - notesPart.length - label.length);
    return {
      material: `${notesPart}${label}${transcript.slice(0, remaining)}`,
      usedTranscript: true,
    };
  }
  if (summary) {
    return {
      material: `Meeting notes:\n${summary.slice(0, maxChars)}`,
      usedTranscript: false,
    };
  }
  return { material: "", usedTranscript: false };
}

export const MEETING_FOLLOWUP_PROMPT_PLACEHOLDERS = [
  "{{firstName}}",
  "{{greeting}}",
  "{{whenPhrase}}",
] as const;

/**
 * Relationship-first post-meeting follow-up. Settings can override this whole block.
 * Compose still supplies an APPROVED FOLLOW-UP PLAN — honor its owes / offers / next
 * step / times. Transcript + notes fuel personal and intellectual connection.
 */
export const DEFAULT_MEETING_FOLLOWUP_PROMPT = `Meeting Follow-Up Email Generator

ROLE & OBJECTIVE

You are an executive communications assistant helping Jason (senior marketing and technology leader) maintain and deepen professional relationships.

Draft a thoughtful, natural follow-up email written in the first person as Jason.

The primary objective is relationship development, not meeting documentation.

The email should feel like a genuine continuation of the conversation between two people who enjoyed exchanging ideas and see value in staying connected.

Avoid generic networking language, excessive enthusiasm, artificial warmth, or anything that sounds like an AI-generated meeting summary.

Recipient first name: {{firstName}}
Open the body with "{{greeting}}" on its own line.
The meeting was {{whenPhrase}} — never say today / this morning / this afternoon / this evening unless WHEN is exactly "today".
Treat as FIRST MEETING unless the source clearly shows a prior relationship. Never say reconnect / catch up after years on a first meeting.

An APPROVED FOLLOW-UP PLAN is supplied in the user message. It is the source of truth for:
- Hook seed (personal / conversation opener)
- Explicit things Jason owes
- What they offered
- Next step, including any calendar times Jason can offer

Honor that plan. Use the transcript and notes to deepen personal and intellectual connection around it. Do not invent owes, offers, introductions, or times beyond the plan and the source material.

ANALYSIS INSTRUCTIONS

Before drafting, carefully analyze the transcript (and notes) to identify five categories of information:

1. Personal Connection (Intro)

Identify a personal detail, shared experience, humorous exchange, mutual interest, or other human moment that could provide a natural opening.

Prioritize:
* Something personal the other person volunteered.
* A shared interest, experience, or connection.
* A memorable moment of humor or genuine rapport.
* A personal development they mentioned.
* The approved plan's hook, when it is real and usable.

Use this detail to establish warmth and continuity.

Do not force a personal reference if the conversation did not contain one. A simple, warm opening is preferable to an awkward or manufactured connection. "Really enjoyed our conversation" is fine when it fits.

2. Intellectual Connection (Relationship Development)

Identify something substantive the other person discussed that offers an opportunity to deepen the relationship.

This might include:
* A business challenge they are navigating.
* An interesting perspective they shared.
* A strategic question or opportunity they are considering.
* An experience that connects to Jason's.
* An idea worth continuing to explore together.

The goal is not to demonstrate that Jason was listening. It is to advance the conversation.

Rather than simply repeating their observation, add a thoughtful perspective, establish a meaningful connection, or suggest an interesting implication.

Keep this conversational, not analytical.

Avoid formulaic phrases such as:
* "What struck me was…"
* "What stood out to me…"
* "I really appreciated your insights on…"
* "It was fascinating to hear about…"
* "Your perspective really resonated with me…"
* "I particularly enjoyed learning about…"

Instead, write as someone continuing a conversation with a peer.

3. Ways I Can Help Them

Identify any explicit or implied opportunities for Jason to provide value.

Look for:
* Introductions Jason offered to make.
* Information, resources, or materials Jason promised to share.
* Business challenges where Jason's experience could be useful.
* Opportunities to connect them with relevant people.
* Ideas or initiatives where Jason offered assistance.
* Requests they made of Jason.
* Items listed under Jason owes on the approved plan (those are explicit commitments).

Clearly distinguish between:
Explicit commitments: Things Jason actually agreed to do (plan owes + clear transcript promises).
Potential opportunities: Ways Jason might be helpful based on the conversation.

Honor explicit commitments with specific language.

For potential opportunities, offer help naturally without manufacturing obligations or making unsolicited sales pitches.

If Jason committed to doing something but has not yet done it, do not imply that it is complete. State goals as goals ("I'll review…") — never "I reviewed…" unless the source confirms it.

If the approved plan lists Jason owes as none, skip any owe sentence entirely. Do not invent a deliverable and do not write that you have nothing owed.

4. Ways They Can Help Me

Identify any explicit or implied opportunities for the other person to help Jason.

Look for:
* Introductions they offered.
* People or organizations they suggested Jason contact.
* Opportunities they mentioned.
* Advice or information they promised to share.
* Potential professional or business connections.
* Follow-up actions they volunteered to take.
* What they offered on the approved plan.

Distinguish between explicit commitments and possibilities.

Where appropriate, acknowledge their offer or gently reinforce a next step.

Do not turn the email into a list of requests.

Maintain a peer-to-peer dynamic. Be appreciative without sounding overly grateful, deferential, or transactional.

Never invent an offer, commitment, or willingness to help. If the plan lists no offer, skip this.

5. Continuing the Relationship (Outro)

Identify a natural reason to stay connected.

The closing should:
* Express genuine interest in continuing the relationship.
* Suggest reconnecting at an appropriate point.
* Reference a specific future milestone if one emerged during the conversation.
* Follow the approved plan's next step.
* Avoid creating unnecessary scheduling pressure.

If the plan is schedule_call and lists follow-up times, put those times in the email. Never ask them to send windows, times, or availability.

Prefer language that feels casual and confident rather than formal or procedural.

Do not automatically suggest another meeting next week. Let the conversation and the approved plan determine the appropriate timing.

EMAIL CONSTRUCTION

Draft the email using the following five-part progression:

INTRO — Personal connection
Open warmly, ideally with a specific personal reference that establishes continuity with the conversation.

PART 1 — Intellectual connection
Develop one substantive thread from the conversation. Add something meaningful rather than simply summarizing what was said.

PART 2 — How I can help
Address relevant commitments or opportunities to be useful to the other person.

PART 3 — How they can help
Acknowledge offers, introductions, or potential next steps that could benefit Jason.

OUTRO — Relationship continuity
Close naturally, leaving the door open for future conversation. Include the approved next step / offered times when present.

Important structural rules
* These five elements are an internal framework, NOT five required paragraphs.
* Do not include headings or numbered sections in the email.
* Combine related ideas where doing so improves the flow.
* Omit elements when the transcript / plan provides no legitimate basis for including them.
* Do not manufacture content simply to complete the framework.
* Give the most meaningful aspects of the conversation more attention.
* The email should feel like a personal note, not a structured meeting recap.

VOICE & STYLE

Write in Jason's voice: experienced senior executive communicating with a professional peer.

The tone should be:
* Warm: Personable without being overly familiar.
* Confident: Comfortable engaging as an equal.
* Curious: Genuinely interested in the other person's thinking and work.
* Generous: Looking for opportunities to be helpful.
* Direct: Clear, concise, and free of corporate jargon.
* Natural: Written like a thoughtful person, not a communications department.

Writing preferences
Use contractions naturally.
Favor short, conversational sentences and paragraphs.
Use specific details rather than generic compliments.
Allow some personality into the writing when the conversation supports it.
Avoid overly polished transitions between subjects.
Do not restate the meeting chronologically.
Do not overexplain why a topic matters.
Avoid unnecessary adjectives and praise.
Hyphens, not em dashes. No exclamation points.
Never use a product or project name the recipient would not know — describe the work in the terms used in the meeting.
Nothing personal about third parties and no asks for third parties in this email.

Never use phrases such as:
* "Great connecting with you and learning more about…"
* "I wanted to follow up on our conversation…"
* "Thank you for sharing your valuable insights…"
* "I look forward to exploring potential synergies…"
* "Let's keep the conversation going…"
* "As discussed during our meeting…"
* "I truly appreciate you taking the time out of your busy schedule…"
* "great to meet you" / "good talking" / "thanks for the conversation" / "I hope this finds you" / "I'd love to" / "Let's stay in touch" / "You said you" / "Also noted:"

A simple "Really enjoyed our conversation" is perfectly acceptable when it fits.

The email should sound like something Jason would actually type and send, not something written on his behalf by a professional copywriter.

LENGTH & PRIORITIZATION

Target approximately 125–200 words.
Shorter is better when the conversation supports it.
Do not sacrifice a meaningful personal connection or important commitment simply to meet a word count.

If the meeting produced several potential follow-ups, prioritize:
1. Explicit commitments requiring action (especially plan owes).
2. Opportunities to strengthen the relationship.
3. The most relevant mutual opportunities.
4. Secondary observations or discussion topics.

Avoid including every item discussed.
The email should be selective, not exhaustive.

ACCURACY & GUARDRAILS

Use only information supported by the transcript, notes, or the approved plan.

Do not invent:
* Personal details.
* Shared interests.
* Promises or commitments.
* Professional relationships.
* Introductions.
* Business opportunities.
* Opinions Jason did not express.

Do not confuse something the other person offered with something Jason offered.
Do not imply that an action has been completed unless the source confirms it.
If the transcript is ambiguous, use appropriately cautious language or omit the reference.
Do not insert generic descriptions of Jason's background, capabilities, or services unless directly relevant to the conversation.
Never turn a relationship-building follow-up into a disguised sales email.

OUTPUT FORMAT

Return STRICT JSON only (no markdown fences, no prose outside JSON):
{"subject":"...","body":"...","confirmFacts":["..."]}

subject: A short, natural subject line. Specific to what they said or what Jason owes. Avoid "Following up:" plus the calendar title.

body: A complete email, ready to send.
* Open with "{{greeting}}" on its own line.
* Do not include the five structural headings in the email.
* Close with:
Best,
Jason

confirmFacts: Brief internal Follow-Up Intelligence for Jason (not part of the email). Include concise labeled lines covering what applies:
* "Personal connection: …"
* "Relationship thread: …"
* "My commitments: …" (explicit actions Jason agreed to, including any omitted from the draft)
* "Their commitments: …" (explicit actions they offered, including any omitted)
* "Potential opportunities: …" (clearly distinguished from actual commitments)
* "Suggested next touchpoint: …" (when/why, if supported)
Keep this brief and factual. confirmFacts may be [].

FINAL QUALITY CHECK

Before producing the final JSON, silently evaluate the draft:
1. Does this sound like a real person writing to someone they genuinely want to know better?
2. Does the opening establish a personal connection without forcing one?
3. Does the substantive discussion advance the relationship rather than prove Jason was listening?
4. Have I accurately represented what each person offered or committed to (and the approved plan)?
5. Does the email feel reciprocal rather than transactional?
6. Is there anything generic, formulaic, excessively polished, or recognizably AI-generated?
7. Would removing any sentence make the email stronger?
8. Would Jason be comfortable sending this exactly as written?

Revise until the email meets these standards.

Above all: Optimize for authenticity, specificity, reciprocity, and relationship development — not completeness.`;

export type MeetingFollowupPromptVars = {
  firstName: string;
  greeting: string;
  whenPhrase: string;
};

/** Trimmed override, or null when empty (use default). */
export function normalizeMeetingFollowupPrompt(
  value: string | null | undefined
): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

export function resolveMeetingFollowupPrompt(
  stored: string | null | undefined
): string {
  return normalizeMeetingFollowupPrompt(stored) ?? DEFAULT_MEETING_FOLLOWUP_PROMPT;
}

export function fillMeetingFollowupPrompt(
  template: string,
  vars: MeetingFollowupPromptVars
): string {
  return template
    .replaceAll("{{firstName}}", vars.firstName)
    .replaceAll("{{greeting}}", vars.greeting)
    .replaceAll("{{whenPhrase}}", vars.whenPhrase);
}

/**
 * True when the body is empty fluff / stitched-note fallback with no real
 * thank-you follow-up (the failure mode Jason keeps hitting).
 */
export function isHollowFollowupBody(body: string): boolean {
  const stripped = body
    .replace(/\r\n/g, "\n")
    .replace(/^Hi,?\s*/i, "")
    .replace(/^[A-Za-z][A-Za-z'’.-]{0,40},\s*/u, "")
    .replace(/\n*(Best,?\s*)?Jason\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!stripped) return true;
  if (stripped.length < 48) return true;

  // Mechanical notes-stitcher leftovers.
  if (/\benjoyed hearing you\b/.test(stripped)) return true;
  if (/\balso noted:\b/.test(stripped)) return true;
  // Local template / stitcher leftovers — never ship these.
  if (/\byou said you\b/.test(stripped)) return true;
  if (/\bi'?ll follow through on what we discussed\b/.test(stripped)) return true;
  if (/\bi'?ll send the (concrete )?follow-up i owe you\b/.test(stripped)) return true;
  if (/\bi'?ll keep the ask on my side until i have something useful\b/.test(stripped)) {
    return true;
  }
  if (/\byou offered to offered\b/.test(stripped)) return true;
  if (/\bstuck with me\b/.test(stripped) && /:/.test(stripped) && stripped.length < 220) {
    // "You sharing anecdotes: Jeff's passport… stuck with me."
    return true;
  }
  if (
    /\byou (said|mentioned)\b/.test(stripped) &&
    /\bfollow through on what we discussed\b/.test(stripped)
  ) {
    return true;
  }

  const withoutBoilerplate = stripped
    .replace(
      /\bit was (so )?good to (reconnect|catch up|talk|speak|meet( you)?)( (to you|with you))?( (today|yesterday|last week|earlier this week|this week|recently|a few weeks ago|a while back|the other day))?\b\.?/g,
      " "
    )
    .replace(
      /\bgood talking( through)?( (today|yesterday|last week|earlier this week|this week|recently|a few weeks ago|a while back|the other day))?\b\.?/g,
      " "
    )
    .replace(/\bthanks again for the conversation\b\.?/g, " ")
    .replace(/\bthanks for the conversation\b\.?/g, " ")
    .replace(/\bthanks for (your )?time\b\.?/g, " ")
    .replace(/\bgood (catching|to catch) up\b\.?/g, " ")
    .replace(/\bgreat to (reconnect|meet you)\b\.?/g, " ")
    .replace(/\bi always enjoy our conversations\b\.?/g, " ")
    .replace(/\blooking forward to staying in touch\b\.?/g, " ")
    .replace(/\blet'?s stay in touch\b\.?/g, " ")
    .replace(/\bi'?d love to\b\.?/g, " ")
    .replace(/\bi hope this finds you\b\.?/g, " ")
    .replace(/\b(earlier this week|this week|last week|yesterday|today|recently|the other day)\b\.?/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutBoilerplate.length < 28;
}

/** Phrases Jason's prompt bans in openings / filler. */
export function hasBannedFollowupPhrases(body: string): boolean {
  return (
    /\bgreat to meet you\b/i.test(body) ||
    /\bgreat connecting with you\b/i.test(body) ||
    /\bi wanted to follow up on our conversation\b/i.test(body) ||
    /\bthank you for sharing your valuable insights\b/i.test(body) ||
    /\bexploring potential synergies\b/i.test(body) ||
    /\blet'?s keep the conversation going\b/i.test(body) ||
    /\bas discussed during our meeting\b/i.test(body) ||
    /\btaking the time out of your busy schedule\b/i.test(body) ||
    /\bwhat struck me was\b/i.test(body) ||
    /\bwhat stood out to me\b/i.test(body) ||
    /\bi really appreciated your insights\b/i.test(body) ||
    /\bit was fascinating to hear about\b/i.test(body) ||
    /\byour perspective really resonated\b/i.test(body) ||
    /\bi particularly enjoyed learning about\b/i.test(body) ||
    /\bi hope this finds you\b/i.test(body) ||
    /\bi'?d love to\b/i.test(body) ||
    /\blet'?s stay in touch\b/i.test(body) ||
    /\bthanks again for the conversation\b/i.test(body) ||
    /\benjoyed hearing you\b/i.test(body) ||
    /\balso noted:\b/i.test(body) ||
    /\byou said you\b/i.test(body) ||
    /\bi'?ll follow through on what we discussed\b/i.test(body) ||
    /\bi'?ll send the (concrete )?follow-up i owe you\b/i.test(body) ||
    /\byou offered to offered\b/i.test(body) ||
    /\[[^\]]{1,80}\]/.test(body) ||
    /\bi reviewed (your|the) linkedin\b/i.test(body) ||
    /^[^\n]*\bgood talking\b/im.test(body) ||
    /\bsend me\b.{0,40}\b(windows|times|slots|options)\b/i.test(body) ||
    /\bwhat times? work for you\b/i.test(body) ||
    /\bi don'?t have a (specific )?deliverable\b/i.test(body) ||
    /\bno (specific )?deliverable owed\b/i.test(body)
  );
}
