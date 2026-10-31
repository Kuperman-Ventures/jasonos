/** Shared lane definitions for prompts and the scoring brief. */
export const NETWORK_SCREEN_LANE_DEFINITIONS = `- job_search: hires, recruits for, or influences the hiring of a CMO or SVP Marketing at a B2B tech company. Includes executive recruiters, CEOs and CROs at B2B tech companies with 100+ people, PE/VC talent partners, and board members.
- advisors: a prospect or referral source for Kuperman Advisors fractional CMO and GTM diagnostic work. Founder, CEO, CRO, or VP Sales at a B2B SaaS, tech, or fintech company that reads as Series A to Series B or $2M-$50M ARR. Also PE/VC operating partners who place advisors into portfolio companies.
- industry: worth knowing but not a hiring path or a prospect. CMOs and marketing leaders at large companies, agency and media leaders, OOH and adtech people, speakers, authors, and people in the same conference circuit.
- none: no connection to any of the three.`;

/** Instructions for classifying every captured connection into lanes and tiers. */
export const NETWORK_SCREEN_STRATEGY = `You will see one person's visible LinkedIn connections. Classify every person into exactly one lane, then mark tiers.

Lanes:
${NETWORK_SCREEN_LANE_DEFINITIONS}

Rules:
- One lane per person. If a person fits two lanes, pick the one with the more concrete near-term ask. A B2B SaaS CEO at a 40-person company is advisors. A CEO at a 500-person company is job_search.
- Company size is not in the data. Use only signals in the headline (Series A, seed, PE-backed, startup, founder, "10x growth", named large company). Do not guess ARR. When the headline gives no size signal, do not put the person in advisors.
- Skip anyone with linkedin_degree 1st for the intro ask. Mark them tier2, next_action "Reactivate directly", lane by the same rules.
- tier1 is exactly the three strongest intro asks, any lane, ordered strongest first. Prefer job_search when two asks are equal in strength.
- tier2 is everyone else in a real lane. Write a one-sentence why for each. No ask for tier2.
- none gets no why and no ask.

Buckets by lane:
- job_search: hiring_path, recruiter, peer_referral
- advisors: prospect, operating_partner
- industry: industry_peer, speaking_content
- none: not_relevant

For each person write:
- id: the id from the input
- lane: job_search, advisors, industry, or none
- tier: tier1, tier2, or none
- bucket: one of the buckets above for that lane
- title and company when clear from the input
- why: for tier1, two sentences naming what they do and which ask an introduction would serve. For tier2, one sentence. Use only the headline, title, company, and location you were given. Do not invent a relationship, an open role, or any fact that is not in the input.
- ask: for tier1 only, one sentence Jason can send the connector. Specific to that person. Empty for tier2 and none.

Return one entry per person in the input. Order tier1 strongest first, then the rest.`;

export const DRAFT_RULES = `- Never use a product name the recipient would not know (for example "Refactor Sprint"). Describe the work in the terms used in the meeting notes.
- Close the loop on any open commitment from the meeting notes before making the ask.
- Include one reciprocity line tied to the connector's own goals from the meeting notes. If the notes have nothing, leave reciprocity out. Do not invent it.
- Do not pitch a partnership the notes show was already discussed.
- Hyphens, not em dashes. Plain language. No clever phrasing.`;

export const BLURB_RULES = `FORWARDABLE INTRO BLURB RULES:
- Written as the connector, in first person, about Jason, addressed to the person being introduced. The connector will paste this into their own email. It must not sound like Jason wrote it.
- 80 to 120 words. One paragraph. No subject line, no greeting, no sign-off.
- Four beats in this order: how the connector knows Jason (from the meeting notes or relationship, one sentence); what Jason does, in terms this person would recognize (one sentence); why this person specifically, reusing the "why" line (one sentence); a low-stakes ask that hands off to Jason, for example "Worth 20 minutes? I'll let Jason take it from here." (one sentence).
- Never use a product name the person would not know (for example "Refactor Sprint"). Describe the work plainly.
- Use "fractional CMO" only if the person's bucket is peer_referral or hiring_path at a company under $50M ARR. Otherwise say "marketing leader" or "CMO".
- Do not overstate the connector's relationship with Jason. If the meeting notes show one conversation, say "we spoke recently", not "I've known Jason for years".
- No flattery of the person being introduced. No "I think you two would really hit it off".
- Hyphens, not em dashes. Plain language. No clever phrasing.`;
