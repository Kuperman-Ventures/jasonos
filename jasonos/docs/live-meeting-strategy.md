# Live as a meeting strategy system

Working note for Jason Kuperman. October 18, 2026.

This is a strategy document, not a build spec. It records the idea as described, what JasonOS already does, and a first cut at how the product could grow. UI work can happen in another session from this file.

## The idea

Live should help build the strategy for a meeting, then carry that strategy onto the screen while the meeting is happening.

There are two starting points.

A generic strategy is not tied to a person. "Discovery meeting" and "Networking meeting" are examples. Jason writes the shape once: why this kind of conversation exists, what a good one produces, and the beats he wants in front of him. He can rehearse it with nobody attached. Later he applies it to a real calendar event and the copy changes for that room.

A specific strategy starts from a real meeting. "Upcoming meeting with John Dokes" already has context: earlier Granola notes with John, how Jason met him, what was promised, what Jason wants from the relationship. The run of show for that call should come out of that material, not from a blank list of headlines.

Both paths end in the same place. During the call, Live shows prompts Jason can follow: the point, the words, the question, the ask. After the call, the meeting joins a library. Each meeting can be scored against the goal Jason named for it, and against how the relationship moved.

## What is already built

Live lives under Custom Comms at `/live`. There is no separate top-level nav item.

Today's meetings split into "Ready to go live" and "Needs points first." A meeting is ready when `meeting_points` has at least one row. Start live opens `/meetings/[id]/live`.

A script is a named, ordered list in `live_scripts` and `live_script_items`. It has no meeting, no covered/skipped state, and no notes. Kinds are `agenda`, `point`, `question`, and `ask`. Items may contain `{{name}}`, `{{company}}`, and `{{title}}`.

Applying a script copies items into that meeting's `meeting_points`. Add appends. Replace deletes the meeting's points first, after a confirm. Placeholders fill from the first matched attendee (`context.people[0]`). A token with no value stays as written. After the copy, the meeting and the script do not stay linked in content. `meeting_preps.script_id` records which script was last applied. `use_count` and `last_used_at` update on the script. Editing either side later does not edit the other.

Save as script does the reverse. It copies kind, headline, and detail, in order, and drops state and notes.

Rehearse opens the same live screen with no meeting. Marks and notes stay in memory. Reset clears them. Reload shows the script's saved items unchanged. The header says Rehearsal, and the footer says nothing is saved.

On a real meeting, marks, notes, the elapsed clock, and Done persist. Done sets `live_ended_at` and returns to the prep page.

The live screen is the player: a rail of points, a large headline, the detail as the words to say, questions and asks in a callout, a note field, Covered / Skip, and keyboard shortcuts. On the script edit page, the spoken text is a large box and line breaks are kept.

AI draft exists in two forms.

For a calendar meeting, `draftMeetingPoints` reads the prep purpose plus meeting context and appends 5 to 9 points. It does not rewrite a headline Jason already has, and it does not touch a point he edited. The user message includes the title, attendees, "what you want out of this," the composed brief (summary, next move, topics, commitments), where it stands, Jason's stake, the introduction, the last two past meetings that have a debrief or a next step, and job-search rows when those exist.

For a script, `draftLiveScriptItems` sees only the script name, the description, and a brief Jason types. The model is told to use the placeholders where a line would otherwise name a person or company. A second run adds only new headlines.

## What JasonOS already knows, and Live barely uses

The prep page already assembles a person. `loadMeetingContext` pulls contacts, the relationship brief, commitments, who referred Jason, personal goal, research, earlier meetings, follow-up debriefs, and a Granola search for the contact. The points drafter uses only a slice of that.

These fields already exist and matter for the idea:

- Contact: `relationship_type`, `intent`, `network_role`, `personal_goal`, `referred_by_contact_id`, `cadence_interval`, `next_touch_date`, `last_touch_date`, notes.
- Relationship brief: summary, helped, topics, commitments (direction `mine` or `theirs`, status, due date), remember, next move.
- Earlier meetings and follow-ups: title, debrief notes, next step, Granola summary and URL when stored.
- Prep: purpose, purpose source, and the live session timestamps.
- Projects: `goal_statement` and `success_criteria` on `jasonos.projects`, one track each. This is the closest thing to "Jason's goals" in the database. It is not wired to Live.
- Job scoreboard: applications and results. That is a job-search log, not a meeting score.

The points drafter does not receive Granola summary text, the referrer, the personal goal, cadence, or the project goal. Past meetings are capped at two, and only when they have a debrief or a next step. A Granola note with no debrief row can sit on the prep page and never reach the draft.

Placeholder fill is name, company, and title. It does not rewrite a generic Discovery script into John's situation. That rewrite is the gap between a script and a strategy for a specific meeting.

## Two objects, one player

Keep the live screen as the player. Do not invent a second in-call UI. What changes is what gets written into points before the call, and what gets written back after Done.

Call the reusable object a strategy. A script, as built, is the reusable run of show: ordered points. A strategy is that run of show plus the reason it exists.

A strategy would hold:

- Name. "Discovery meeting", "Networking meeting."
- The situation it is for, in a sentence.
- The outcome that counts as success for this kind of meeting. One sentence Jason can score later. Example: "They describe the problem in their words, and we leave with a dated next step."
- Optional beats that should survive customization: open, learn the environment, one ask, close with a commitment. These can stay as script items.
- The spoken points, which already exist as script items.

A specific meeting does not need its own strategy type. It needs a preparation step that reads the strategy (or starts from scratch) and reads the person, then writes `meeting_points` for that `meeting_preps` row. The live screen already plays those points.

For John Dokes, that preparation step should be allowed to use:

- The calendar title, time, and attendees.
- Purpose, if Jason wrote one.
- Relationship brief summary and open commitments.
- How they met: referrer name, intro thread, and the brief's summary. There is no single "how we met" column. The referrer, the intro, and the brief are the sources. If those are empty, the screen should say so instead of inventing an origin story.
- Granola notes already attached to earlier meetings with him, plus a fresh Granola search for the contact.
- The last next step Jason or John owed.
- Jason's `personal_goal` for the contact, and, when he picks one, a project `goal_statement`.

The model proposes points. Jason edits them in the same editor he has now. Nothing in that list is marked covered until he is in the meeting.

Generic rehearsal stays as it is: placeholders visible, nothing saved. Rehearsing "Discovery" is how he learns the beats. The John Dokes run of show is a different object, produced when he applies Discovery to John's meeting or asks for a draft from John's context directly.

Applying a generic strategy to John should do more than substitute `{{name}}`. Substitution is the right behavior for a line like "Ask {{name}} what changed at {{company}}." It is the wrong behavior for a whole meeting plan. The apply step for a real meeting should be allowed to rewrite detail from context, then store the result on the meeting. The strategy itself stays generic. That matches the rule already shipped: later edits do not flow backward.

## During the meeting

The final output Jason asked for is on-screen prompts. The current screen is already that, once the points are good.

What the prompts need, beyond a headline:

- The line he might say, which is `detail`.
- The kind, so an ask looks different from a topic.
- Enough context to remember why this prompt is here, without turning the screen into the prep page. A single line under the prompt is enough: "John said in March he would send the board notes" or "You met through Tracy." Collapsed by default on a small laptop. The prompt stays the largest type on the screen.
- A note for what they actually said. That field exists. After the call it is the raw material for the library and the score.

Covered and skipped stay. They are the first score: did he reach the ask, or did he skip it.

## After the meeting: library and score

Done currently records `live_ended_at` and returns to the prep page. The points, states, and notes remain on that meeting. There is no library view of past live sessions, and nothing scores the meeting against a goal.

The library is a list of meetings Jason has run through Live, plus the strategies he reused. Group by person and by strategy name. Each row shows the date, who was in the room, which strategy it started from, the outcome sentence, and whether the ask was covered. Open a row to read the prompts, the notes he typed, and the Granola note if one landed later.

Scoring should use goals he already stated, not a new scoring theory.

Before the call, he names the outcome for this meeting. That can start as the prep purpose, or as the strategy's success sentence copied onto the meeting so he can edit it. After the call, he marks that outcome hit, partial, or missed, in one click, and can add a sentence. That is the meeting score. It is his judgment. The model can suggest a mark from the notes and from which points were covered. It should not file the mark until he confirms. That matches the existing rule that nothing sends and judgment stays with him.

Relationship metrics should be movements of records JasonOS already keeps, counted from meetings, not a parallel scoreboard.

Useful ones:

- Commitments opened and closed, split into his and theirs, from the relationship brief. A meeting that creates a dated next step and a meeting that closes an overdue one are different results.
- Whether `next_touch_date` moved, and whether the touch landed inside `cadence_interval`.
- Whether `personal_goal` for that contact changed or got closer. The goal text is his. The metric is time since it was set, and whether the last meeting's outcome mentioned it. Do not auto-rewrite the goal.
- Repeat meetings with the same person, and days since the previous one. That is the farmer pace already in his notes: goodwill over a long window, not a hunter count of new names.
- Asks covered versus skipped, by strategy. Discovery meetings that never reach the close are a pattern he can see.

The October 6 measurement discussion was about marketing (objective, then challenge, then priority, then a measurable objective). It was not a meeting-score design. The same shape still fits if he wants it: project `goal_statement` at the top, this meeting's outcome sentence under it, then one or two observable results (commitment logged, next meeting dated, ask covered). Citation: [Oct 6, 2026 notes](https://notes.granola.ai/d/9874cec2-b12d-4f1d-b4c0-65a6b83a9329).

Job scoreboard stays the job-search log. A recruiting conversation can link to it. It should not become the score for every Live meeting.

## Nearby notes, not a spec for Live

Granola has no note that decides Live, scripts, or on-screen prompts. These are related and worth using as examples when drafting real strategies:

- August 12, 2026, Seth call plan: open as a researcher, read the other person's energy, pick threads instead of forcing the agenda, ask about their AI work before pitching, leave with two concrete next steps. [Notes](https://notes.granola.ai/d/89a4d463-2091-49ec-b1dd-c06478c31e2c).
- September 16, 2026, discovery workshop: advise before pitching, restate why the meeting is happening, learn their environment, ask why they took the meeting, paraphrase, close with a commitment. Personal connection was described as the defense against ghosting. [Notes](https://notes.granola.ai/d/529c4c82-7957-477b-8a57-14562048d96a).
- September 30, 2026, Andrew Romano: farmer, not hunter; returns often take one to two years; intro asks should be short, forwardable, and ranked. [Notes](https://notes.granola.ai/d/8929cb5d-a454-4c8a-8817-ad9654b8d997).

A Discovery strategy and a Networking strategy can be written from those notes by Jason, in his words. The product should not import them as hidden defaults.

## First UI thoughts

These are a starting point for a later design pass. They are not a layout spec.

Live hub, still one page:

- Today's meetings, as now.
- Strategies, the current Scripts section, with the outcome sentence on each row next to the point count.
- Recent meetings, a short list of the last Live sessions: person, date, strategy name, outcome mark. This is the start of the library. A full library can be a filter on this page, not a new nav item.

Strategy page, the current script page plus two fields: situation, and what success looks like. Points stay the editor he has, including the large box for spoken text. Rehearse stays. "Apply to a meeting" stays, and gains a third action next to Add and Replace: Adapt. Add and Replace keep today's copy behavior. Adapt rewrites detail from that meeting's context, shows the proposed points, and lets him accept them onto the meeting. He should see the generic version and the adapted version before anything is deleted.

Meeting prep, "Points to make":

- If a strategy was applied, the line already says which script. Add the outcome sentence under it, editable.
- "Draft from this meeting" should pass the context the prep page already loaded: Granola summaries, referrer, personal goal, open commitments, last next step. Same rule as now: add headlines he does not already have.
- A short "Context used" list under the draft button: Granola note titles, the brief, the referrer. If a source was missing, say missing. He should know when the draft had nothing on how he met John.

Live screen:

- Keep the current stage. Add one optional context line under the spoken text, fed from the point or from the meeting, not a second column of research.
- After the last point, or when he hits Done, ask for the outcome mark before leaving. Hit, partial, missed, plus an optional sentence. Store it on the meeting. If he dismisses it, the meeting still ends and the library shows the mark as unset.

Library:

- Filters: person, strategy, outcome mark, date.
- A person page inside it: meetings with John, the goal on his contact, open commitments, cadence, last touch. That page reads records. It does not become a CRM redesign.

## What I would build first

1. Put the outcome sentence on the strategy and copy it onto the meeting at apply time.
2. Widen the meeting draft context to include Granola summaries, referrer, personal goal, and open commitments. Do not raise the point count past the current 5 to 9.
3. On Done, capture the outcome mark and show recent Live meetings on `/live`.
4. Only then build Adapt, which rewrites a generic strategy for a named person. Add and Replace already cover the mechanical copy.

Relationship counts (commitments, cadence, repeat meetings) can be a report on the library once outcome marks exist. Counting them before he is scoring meetings will produce a dashboard he does not look at.

## Open choices

- Whether "strategy" replaces the word "script" in the UI, or a script stays the point list and the strategy is the wrapper around it. The database can keep `live_scripts` either way.
- Whether Adapt may delete existing meeting points, or only proposes a list he applies with the current Replace confirm.
- Which goal a meeting is scored against when several apply: the sentence for this meeting, the contact's `personal_goal`, or a project `goal_statement`. The meeting sentence should be required. The others are links, not substitutes.
- How long Granola text is allowed to be inside a draft prompt. The prep loader already searches Granola. The draft should receive summaries, not full transcripts, unless a transcript is short enough to quote a commitment.

## Out of scope for this idea

- A second in-call interface, teleprompter theme, or slide deck.
- Auto-sending follow-up email from Done.
- Scoring relationships with a single number.
- Using the job scoreboard as the meeting library.
