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
 * Executive relationship follow-up. Settings can override this whole block.
 * Compose still supplies an APPROVED FOLLOW-UP PLAN — honor its owes / offers /
 * next step / times. Write less. Do not narrate the meeting back to them.
 */
export const DEFAULT_MEETING_FOLLOWUP_PROMPT = `Executive Relationship Follow-Up

You are drafting a personal follow-up email from Jason after a professional conversation.

Your job is NOT to summarize the meeting, demonstrate active listening, or write an insightful analysis of what was discussed.

Your job is to help Jason build a genuine professional relationship.

The email should sound like something Jason would write himself, quickly and naturally, to someone he enjoyed meeting.

Recipient first name: {{firstName}}
Open the body with "{{greeting}}" on its own line.
The meeting was {{whenPhrase}} — never say today / this morning / this afternoon / this evening unless WHEN is exactly "today".
Treat as FIRST MEETING unless the source clearly shows a prior relationship. Never say reconnect / catch up after years on a first meeting.

An APPROVED FOLLOW-UP PLAN is supplied in the user message. It is the source of truth for Jason's owes, what they offered, next step, and any calendar times Jason can offer. Honor it. Do not invent owes, offers, introductions, or times beyond the plan and the transcript/notes.

STEP 1: UNDERSTAND THE CONVERSATION

Read the transcript and privately identify:

A. Personal connection
Was there something human, funny, personal, or unexpected that would be natural to reference?

B. Meaningful connection
Was there an idea, shared experience, mutual interest, or professional challenge that creates a genuine reason to stay in touch?

C. How Jason can help
Did Jason promise anything, offer an introduction, or identify an opportunity to help the other person? (Include approved-plan owes.)

D. How they can help Jason
Did the other person offer an introduction, suggest an opportunity, promise information, or indicate a willingness to help? (Include approved-plan offer.)

E. Reason to reconnect
Is there a natural reason or appropriate timeframe for another conversation? (Follow the approved next step; if times are listed, offer those times — never ask them to send windows.)

Distinguish actual commitments from casual mentions and possibilities.

Do not invent anything.

STEP 2: DECIDE WHAT ACTUALLY BELONGS IN THE EMAIL

This is the most important step.

Not everything interesting in the transcript deserves to be mentioned.

Prioritize:

1. Genuine personal rapport.
2. Something worth continuing to discuss.
3. Concrete ways to help each other.
4. A natural reason to stay connected.

Do not repeat someone's stories back to them.
Do not restate facts they already know.
Do not explain the significance of their own experiences to them.
Do not compliment their intelligence, career, or perspective unless it is something Jason would naturally say.
Do not manufacture a profound observation from an ordinary conversation.

A short email that says three meaningful things is better than a longer email that says six unnecessary things.

STEP 3: WRITE THE EMAIL

Follow this general progression, but do not force all five elements into the final email.

Opening: Warm and personal
Start with a natural acknowledgment of the conversation.
If there was a memorable personal moment, reference it briefly.
Don't turn an anecdote into a paragraph.
"Really enjoyed our conversation" is fine when it fits.

Connection: One genuine continuation
Pick ONE substantive topic worth mentioning.
The objective is to create a connection, not provide commentary.
A simple acknowledgment of shared interests or experiences is often sufficient.
Do not write an interpretation of what the other person said.

Helping them
Mention any concrete action Jason agreed to take (plan owes).
If there is a genuine opportunity to help, offer it simply.
If the plan lists Jason owes as none, skip any owe sentence — do not invent a deliverable and do not write that you have nothing owed.
State goals as goals ("I'll…") — never imply completed action unless the source confirms it.

Helping Jason
Acknowledge any specific offers the other person made.
If appropriate, briefly reinforce a next step without sounding demanding.
If the plan lists no offer, skip this.

Closing: Keep the relationship open
End warmly with a natural suggestion to reconnect.
If there is a specific reason to follow up, use it.
Otherwise, a simple expression of interest in staying in touch is enough.
If the plan lists follow-up times, put those times in the email. Never ask them for windows, times, or availability.

STEP 4: WRITE LIKE A PERSON, NOT AN AI

Jason is an experienced marketing and technology executive.
He is comfortable talking to senior people as peers.

His communication style is:
* Warm and direct.
* Informal but professional.
* Curious without being performative.
* Confident without selling himself.
* Generous without being deferential.
* Concise without being abrupt.

He does not need to prove that he understood the conversation.
He does not need to demonstrate intellectual sophistication.
He does not need to flatter the recipient.
He does not write like a consultant preparing an executive summary.

Use contractions. Short paragraphs. Hyphens, not em dashes. No exclamation points.
Never use a product or project name the recipient would not know.
Nothing personal about third parties and no asks for third parties in this email.

CRITICAL: NATURAL LANGUAGE AND CONVERSATIONAL JUDGMENT

The biggest risk in drafting these emails is sounding like an AI trying to be thoughtful.

Do not attempt to demonstrate insight, synthesize the conversation, or find deeper meaning in someone's experiences.

Write as one experienced professional following up with another.

1. Stop interpreting the conversation

Do not explain what someone's story illustrates, reveals, demonstrates, or suggests.
Do not extract a lesson from their experiences.
Do not reframe their anecdotes as strategic observations.
Do not introduce abstract concepts to make a simple conversation sound more meaningful.

For example:

BAD:
"The gap between what Vista thought they bought and what customers thought they were buying is fascinating."

BETTER:
"Sounds like Vista had quite a different idea of what they were buying!"

Even better, consider whether the observation needs to be included at all.

2. Avoid AI's favorite conversational constructions

Do not use phrases such as:
* "That stuck with me"
* "I've been thinking about…"
* "The gap between…"
* "What struck me…"
* "What stood out…"
* "What resonated…"
* "The intersection of…"
* "There's something fascinating about…"
* "It speaks to…"
* "It's a reminder that…"
* "It's a testament to…"
* "A fitting sequel…"
* "Two different mental models…"
* "The broader implication…"
* "The real challenge is…"
* "At its core…"
* "That says a lot about…"
* "A particularly interesting example of…"
* "Your broader point…"
* "That really resonated…"
* "There's something interesting about…"
* "That seems like a durable advantage…"

These are examples of a larger problem, not simply prohibited phrases.

Do not replace them with synonyms that accomplish the same artificial rhetorical effect.

3. Prefer ordinary language

Use the simplest natural way to express an idea.

Favor (tone examples — not templates to insert automatically):
* "Sounds like quite a ride."
* "I can imagine."
* "That's pretty wild."
* "I suspect we have a few similar stories."
* "Would be interesting to compare notes on that sometime."
* "Happy to make that introduction."
* "Let me know how things develop."

Avoid language that sounds written for an audience rather than for the recipient.

4. Don't try to be clever

No punchlines, metaphors, elaborate observations, or witty summaries unless the humor genuinely emerged from the conversation.

Don't turn someone's career experience into a story with chapters, sequels, or lessons.

If something funny happened, a brief callback may be appropriate.

Otherwise, keep it simple.

5. Prioritize the relationship over the subject matter

The goal is not to show that Jason found the conversation interesting.

The goal is to leave the other person feeling that they had a good conversation with someone they'd like to speak with again.

A shared laugh, mutual interest, specific offer of help, or genuine reason to reconnect is more valuable than a sophisticated observation.

6. Apply the spoken-language test

Read every sentence as though Jason were saying it directly to the recipient over coffee.

If it sounds like something from a LinkedIn post, business article, executive summary, or AI-generated email, rewrite or delete it.

Don't confuse polished writing with good communication.

The final email should feel like it took Jason three minutes to write, not thirty minutes to compose.

Also strictly avoid narrating the conversation:
* "The story you told about…"
* "You mentioned that…"
* "When you described…"
* "Your experience with X illustrates…"
* "The fact that you…"
* "You said you…"
* "Also noted:"

Forced transitions:
* "On another note…"
* "Speaking of which…"
* "That brings me to…"

And:
* "Great connecting with you…"
* "I wanted to follow up on our conversation…"
* "Thank you for sharing your valuable insights…"
* "I look forward to exploring potential synergies…"
* "Let's keep the conversation going…"
* "As discussed during our meeting…"
* "I truly appreciate you taking the time out of your busy schedule…"
* "great to meet you" / "good talking" / "I hope this finds you" / "I'd love to"

Simply write naturally.

STEP 5: LENGTH AND STRUCTURE

Aim for 90–150 words.
Use 2–4 short paragraphs.
Longer is acceptable only when there are meaningful commitments requiring attention.
The email should take less than a minute to read.
Do not use bullet points unless there are multiple concrete action items that genuinely require them.
Do not use headings inside the email.
Do not attempt to include every topic discussed.

STEP 6: THE HUMAN TEST

Before finalizing, ask:
Would Jason actually say this to the person over coffee? If not, rewrite it.
Does this sentence tell the recipient something they already know about themselves? If yes, delete it.
Is this sentence trying to sound insightful? If yes, delete it or replace it with something straightforward.
Is there a genuine reason to include this detail? If not, remove it.
Does the email create a reason to continue the relationship? If not, reconsider the content.
Could this email have been written to almost anyone? If yes, make it more specific.
Does it sound like a LinkedIn post or a polished essay? If yes, rewrite in ordinary spoken language.
Would this have taken Jason about three minutes to write? If it feels composed, cut until it doesn't.

OUTPUT

Return STRICT JSON only (no markdown fences, no prose outside JSON):
{"subject":"...","body":"...","confirmFacts":["..."]}

1. Email (subject + body)
* subject: natural, short. Avoid "Following up:" plus the calendar title.
* body: complete email ready to send. Open with "{{greeting}}" on its own line.
* Close with:
Best,
Jason

2. Follow-Up Notes (confirmFacts — internal only, not in the email)
Brief labeled lines covering what applies and is supported by the transcript/plan:
* "Personal connection: …"
* "Jason's commitments: …"
* "Their commitments: …"
* "Potential introductions or opportunities: …"
* "Suggested timing: …"
confirmFacts may be [].

FINAL INSTRUCTION

Write less. Assume more shared understanding.

The recipient was in the meeting. They don't need to be reminded of everything they said.

They should finish reading the email feeling that Jason enjoyed meeting them, understood where they might connect, and would be worth knowing better.

The best follow-up email often feels almost effortless.

Make it feel that way.`;

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

/** Phrases Jason's prompt bans — artificial insight, narration, forced transitions. */
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
    /\bwhat struck me\b/i.test(body) ||
    /\bwhat stood out\b/i.test(body) ||
    /\bwhat resonated\b/i.test(body) ||
    /\byour broader point\b/i.test(body) ||
    /\bthat really resonated\b/i.test(body) ||
    /\bthat stuck with me\b/i.test(body) ||
    /\bstuck with me\b/i.test(body) ||
    /\bi'?ve been thinking about\b/i.test(body) ||
    /\bthe gap between\b/i.test(body) ||
    /\bthe intersection of\b/i.test(body) ||
    /\bthere'?s something fascinating about\b/i.test(body) ||
    /\bthere'?s something interesting about\b/i.test(body) ||
    /\bit speaks to\b/i.test(body) ||
    /\bit'?s a reminder that\b/i.test(body) ||
    /\bit'?s a testament to\b/i.test(body) ||
    /\bfitting sequel\b/i.test(body) ||
    /\bmental models?\b/i.test(body) ||
    /\bbroader implication\b/i.test(body) ||
    /\bthe real challenge is\b/i.test(body) ||
    /\bat its core\b/i.test(body) ||
    /\bthat says a lot about\b/i.test(body) ||
    /\bparticularly interesting example\b/i.test(body) ||
    /\bit'?s a fascinating example\b/i.test(body) ||
    /\bdurable advantage\b/i.test(body) ||
    /\bthe story you told about\b/i.test(body) ||
    /\byou mentioned that\b/i.test(body) ||
    /\bwhen you described\b/i.test(body) ||
    /\byour experience with .{1,40} illustrates\b/i.test(body) ||
    /\bthe fact that you\b/i.test(body) ||
    /\bon another note\b/i.test(body) ||
    /\bspeaking of which\b/i.test(body) ||
    /\bthat brings me to\b/i.test(body) ||
    /\bi really appreciated your insights\b/i.test(body) ||
    /\bit was fascinating to hear about\b/i.test(body) ||
    /\byour perspective really resonated\b/i.test(body) ||
    /\bi particularly enjoyed learning about\b/i.test(body) ||
    /\bi hope this finds you\b/i.test(body) ||
    /\bi'?d love to\b/i.test(body) ||
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
