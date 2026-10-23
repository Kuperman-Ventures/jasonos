# Browning playbooks

Default text for the playbook blocks seeded by `supabase/migrations/0107_live_playbook_blocks.sql`. Edit a playbook on its page; this file records what the seed writes.

Sources:

- Networking 102, Working Your Browning Associates Networking Referrals, The 4 Topics, and The Ask and Why, as captured in [browning-networking.md](browning-networking.md) and migration `0096_live_browning_seed.sql`.
- Advisors Intro from migration `0098_live_research_and_narratives.sql`.
- Coaching call with Jerry SantaMaria (Browning Associates), Jul 15 2026: the three whys, the four topic areas, "advice" framing for reconnects, and asking about a named shared connection instead of "do you know anybody?"

Placeholders `{{name}}`, `{{company}}`, `{{title}}`, `{{snapshot}}`, `{{targets}}` and `{{narrative:key}}` fill when a call sheet is built. Square brackets are for Jason to fill by hand.

## The ten-block template

Used by Net 102 First Call, Net 102 Second Call, Net 101 Own Network and Net 103 Cold.

| Block | Kind | Required | Rule |
| --- | --- | --- | --- |
| Who | text | no | Read their resume. Find one accomplishment to ask about. |
| Why | lines | yes | Answer the whys before you pick up the phone. |
| What and how | lines | yes | Give before getting. Offer help before asking. |
| Set expectations | text | no | Two minutes. Say what you hope to cover and how long you have. |
| Rapport | lines | no | Five minutes. Genuine and specific. |
| The conversation | points | no | Twenty minutes. 80 percent questions. The four topics. |
| Turn to me | lines | no | Have you looked at my profile? Then the snapshot, under 60 seconds. |
| The ask | ask | no | Who questions, not if questions. Specific, benefit, compelling. |
| Close | text | no | Three minutes. A date, and "I'll send a calendar invite." |
| After | after | no | Thank-you within 24 hours: thanks, topics, actions, reminders, something that helps them. |

Time budget: expectations 2, rapport 5, main 20, close 3. Thirty minutes.

Why lines (blank in every playbook, filled per call):

- Why this person
- Why someone in their network
- Why are we talking again

What and how lines: What I hope to learn · How they can help me · How I can help them.

Rapport lines: Compliment · Common ground · Attention getter.

Turn to me lines: Profile check · Snapshot · If asked "are you looking".

### Shared lines

Turn to me, all four:

- Profile check: Have you had a chance to look at my executive profile? If not, I'd appreciate it when you get a chance.
- Snapshot: {{snapshot}} Target companies: {{targets}}.
- If asked "are you looking": Don't say "I'm looking for a job." Now: [what I'm doing]. Next: [the seat I want]. Why: [why I'm right for it].

After, all four:

> Thank you for the time today. We covered [topics]. I'm going to [actions]. You mentioned you'd [reminder]. Here's [something that helps them].

## Net 102 First Call

First conversation with a Browning referral who has my resume but does not know me.

- How I can help them: I have Browning's network and my own. Tell me who you're trying to reach and I'll see who I know.
- Set expectations: Here's what I was hoping to cover in the next 20 minutes: how your search is going, where I can help, and a quick snapshot of where I am. Do you still have 30 minutes?
- Compliment: I was impressed by [specific accomplishment]. I did something close to it at OUTFRONT / Omnicom and I'd like to hear how you approached it.
- Attention getter: I got your resume from Browning. Reading it, [one specific thing from their background] stood out, and I thought we could be useful to each other.
- The ask (soft, only if the call is going well): Given your years in [industry], you're probably more plugged in than I am to who's doing what. Who would you at least suggest I put on my radar right now?
- Close: I'm glad Browning connected us. I'm going to reach out to a few people where I think you'd be valued and hand them off when I hear back. Can we circle back two weeks from today? I'll send a calendar invite. What day works?

Objections: the six reactions from the circle-back ask and the six from the radar ask in `0096`.

## Net 102 Second Call

Follow-up after a first call and a thank-you note.

Second-call list, in order:

1. What I did for them since the first call.
2. Did they look at my profile, and how does my background read to someone in their seat.
3. My target list, with geography.
4. Their target list. Where are they seeing the most traction.
5. One who question about a named person.
6. The next step and a date.

- How I can help them: Bring one thing I did for them since the first call.
- Set expectations: Three things today: what I did for you since we spoke, our target lists, and one specific name. Is 30 minutes still good?
- Attention getter: After our last call I reached out to [name] about [their need]. Here's where that stands.
- Profile check: Did you get a chance to look at my profile? Any thoughts on how my background reads to someone in your seat?
- Snapshot: Here are the companies I'm focused on: {{targets}}. I'll put this in an email too.
- The ask: I noticed you're connected to [name] at [company]. That's a place I think I could add value. How well do you know them?
  If they offer to pass my resume along: Thank you. Let me give you my executive profile instead. When you talk to them, would it be possible to set up a short conversation first?
- Close: Here's what I'll do by [date]. Can we check in again in three weeks? I'll send a calendar invite.

Objections: the six reactions from the "Who do you know at [target company]?" ask in `0096`.

## Net 101 Own Network

A call with someone who already knows me and will pick up the phone (A1, B1, C1).

- How I can help them: Ask what they're working on and who they're trying to reach before I ask for anything.
- Set expectations: I'd love 30 minutes. I want to hear what you're working on, tell you what I'm doing next, and ask your advice on a couple of companies.
- Common ground: [the last thing we worked on together].
- Attention getter (reconnect): It's been a while. I'm working on something career-wise and could use your advice.
- The ask: I'm focused on {{targets}}. I saw you're connected to [name]. Tell me about them.
- Close: This helped. Can we talk again in three weeks? I'll send a calendar invite.

Objections: same six as Net 102 Second Call (a named-person ask).

## Net 103 Cold

A call with someone who does not know me, introduced by someone who does not know me well either.

- How I can help them: Offer one specific thing before asking: an intro, an article, a name.
- Set expectations: I know you don't know me. [Referrer] suggested we talk. I'm asking for 20 minutes of advice, not a job: how you see [industry], and a quick snapshot of what I'm working on.
- Attention getter: [Referrer] suggested I reach out. I'm making a career move and [referrer] said you'd be the right person to ask.
- The ask: same radar ask as Net 102 First Call.
- Close: Thank you. Can we talk again in a few weeks, after I follow up on what you suggested? I'll send a calendar invite.

Objections: same six as the Net 102 radar ask.

## Other playbooks

- Int 101 Interview: Who · Why (Why this role · Why this company) · Turn to me · The conversation · The ask · Close · After. No time budget.
- Advisors Intro: Who · What and how · Turn to me · Points · The ask · Close · After. Objections from the `0098` next-step ask.
- AgencyToolBox Pitch: Who · What and how · Points · The ask · Close · After. Objections generalized from the Connective Intro tooling ask.
- Blank: Who · What I want from this call (required) · Points · Close · After.

## Question bank

Seeded into `playbook_questions` as shared questions (no playbook).

The 4 Topics, one question each in the repo:

- Industry: What's the biggest challenge in your industry right now?
- Company: Are you aware of companies in transition, going through M&A, or looking for fractional leadership?
- Contacts: Who in your network is the most connected?
- Resources: What tools or recruiters have helped you most?

The full 4 Topics question list and the handbook's six "getting connections" questions are not in the repo. The seed adds every related question found in `0096`, the original Browning points, and the Jul 15 coaching call. Add the rest from the Browning documents on the Playbooks page.
