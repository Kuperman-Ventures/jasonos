/** Shared lane definitions for prompts and the scoring brief. */
export const NETWORK_SCREEN_LANE_DEFINITIONS = `- job_search (priority lane): a person who can hire, recommend, or is running a search for a CMO, SVP Marketing, or VP Marketing seat at a company where that seat exists. Target companies: B2B software, enterprise SaaS, fintech, AdTech, MarTech, media, and advertising, with a size signal (100+ employees, Series B or later, PE-backed, public, or a named company known to be that size). Three buckets, in priority order:
  - hiring_path: CEO, founder, president, COO, CRO, or board member at a target company. Also PE and VC operating partners and talent partners, who place executives into portfolio companies.
  - peer_referral: sitting CMO, SVP Marketing, or VP Marketing at a target company. They hear about open seats before recruiters do.
  - recruiter: executive search professional whose headline names marketing, GTM, revenue, or C-suite searches in one of the target sectors. A recruiter whose headline names no function and no sector is tier2 at most. A recruiter whose headline names a different function (finance, accounting, HR, legal, engineering, operations, supply chain) or a non-target sector (consumer brands, retail, nonprofit, healthcare, industrial, manufacturing, food and beverage, hospitality) is lane none.
- advisors: a prospect or referral source for Kuperman Advisors fractional CMO and GTM diagnostic work. Founder, CEO, CRO, or VP Sales at a B2B SaaS, tech, or fintech company that reads as Series A to Series B or $2M-$50M ARR. Also PE and VC operating partners who place advisors into portfolio companies.
- industry: worth knowing but not a hiring path, a peer referral, or a prospect. Marketing leaders at companies outside the target sectors, agency people below the C-suite, speakers, authors, and conference-circuit contacts. A CEO, president, CRO, or CMO at a media, OOH, AdTech, or advertising company is job_search, not industry.
- none: no connection to any of the three.`;

/** Instructions for classifying every captured connection into lanes and tiers. */
export const NETWORK_SCREEN_STRATEGY = `You will see one person's visible LinkedIn connections (sometimes a chunk of the full list). Classify people into lanes and tiers.

Lanes:
${NETWORK_SCREEN_LANE_DEFINITIONS}

What tier1 means: the three people the connector should be asked to introduce. The connector spends credibility on each ask, so tier1 is reserved for people who can plausibly lead to a CMO or SVP Marketing conversation within one step.

Tier1 requirements. Every requirement must hold or the person is tier2:
- A named company. If the headline gives only a category ("Boutique Search Firm", "Independent", "Executive Recruiter", "Startup Advisor"), leave company empty and mark tier2.
- US-based, judged from the location field. Non-US people are industry or none for job_search.
- Senior enough to hire or recommend at the executive level. Director level and below are none for job_search.
- The why states at least one fact that is not a restatement of the headline: the sector and size signal of the company, the function the person hires for, the stage of the company, or the metro when it is outside the New York area. If the only thing you can say is what the headline already says, mark tier2.
- A specific ask the connector could forward without editing.

Tier1 selection across the full list:
- Rank hiring_path above peer_referral above recruiter when asks are equal in strength.
- At most one recruiter in tier1. Allow two only when the list contains no hiring_path or peer_referral candidates at all.
- Prefer job_search over advisors when two asks are equal in strength.
- Exactly three tier1 across the full list, strongest first. In a chunk, mark the strongest local candidates as tier1; code keeps only three overall.

Rules:
- Only return people who belong on job_search, advisors, or industry. Omit everyone else. Do not return lane "none" entries.
- If a person fits two lanes, pick the one with the more concrete near-term ask. A B2B SaaS CEO at a 40-person company is advisors. A CEO at a 500-person company is job_search.
- Company size is not in the data. Use only signals in the headline (Series A, seed, PE-backed, public, startup, founder, "10x growth", named large company). Do not guess ARR. When the headline gives no size signal, do not put the person in advisors, and do not put the person in job_search tier1.
- Never justify a recruiter with "cross-referral", "adjacent network", "broad network", or "may know hiring managers". Those phrases mean the fit is not there. Mark tier2 or none.
- Skip anyone with linkedin_degree 1st for the intro ask. Mark them tier2, next_action "Reactivate directly", lane by the same rules.
- tier2 is everyone else you return. Write a one-sentence why for each. No ask for tier2.

Buckets by lane:
- job_search: hiring_path, recruiter, peer_referral
- advisors: prospect, operating_partner
- industry: industry_peer, speaking_content

For each returned person write:
- id: the id from the input
- lane: job_search, advisors, or industry
- tier: tier1 or tier2
- bucket: one of the buckets above for that lane
- title and company when clear from the input. Company must be a proper name, never a category.
- why: for tier1, two sentences. Sentence one names the company, the person's role, and the sector or size signal. Sentence two names which ask an introduction would serve. For tier2, one sentence. Use only the headline, title, company, and location you were given. Do not invent a relationship, an open role, or any fact that is not in the input.
- ask: for tier1 only, one sentence Jason can send the connector. Specific to that person. Empty for tier2.

Return only the useful people. Order tier1 strongest first, then tier2.`;

export const DRAFT_RULES = `- Never use a product name the recipient would not know (for example "Refactor Sprint"). Describe the work in the terms used in the meeting notes.
- Close the loop on any open commitment from the meeting notes before making the ask.
- Include one reciprocity line tied to the connector's own goals from the meeting notes. If the notes have nothing, leave reciprocity out. Do not invent it.
- Do not pitch a partnership the notes show was already discussed.
- Name each of the three people. Give one short why for each, drawn from the why lines provided. Then ask for an introduction to each of them. Do not collapse the other names into a single throwaway line.
- Match tone to the warmth setting. Cold or new contacts stay shorter and more direct; warm contacts can close the loop on commitments first.
- Hyphens, not em dashes. Plain language. No clever phrasing.`;

export const INTRO_FOLLOWUP_RULES = `- This email is FROM Jason TO the person he was just introduced to. The connector already made the introduction.
- Open by naming the connector and thanking them for connecting you. One short sentence.
- Say who Jason is in terms this person would recognize, tied to why the intro was worth making. One or two sentences. Use the why/ask lines. Do not invent an open role, a mutual friend, or any fact that is not in the inputs.
- Ask for a short call. Low stakes. One sentence.
- Greet by first name. Sign off "- Jason". Hyphens, not em dashes. Plain language. No clever phrasing.
- Never use a product name the recipient would not know (for example "Refactor Sprint"). Describe the work plainly.
- Do not pitch Kuperman Advisors unless the person's lane/bucket is advisors (prospect or operating_partner). For job_search intros, stay on the CMO / SVP Marketing search.`;

export const BLURB_RULES = `FORWARDABLE INTRO BLURB RULES:
- Written as the connector, in first person, about Jason, addressed to the person being introduced. The connector will paste this into their own email. It must not sound like Jason wrote it.
- 80 to 120 words. One paragraph. No subject line, no greeting, no sign-off.
- Four beats in this order: how the connector knows Jason (from the meeting notes or relationship, one sentence); what Jason does, in terms this person would recognize (one sentence); why this person specifically, reusing the "why" line (one sentence); a low-stakes ask that hands off to Jason, for example "Worth 20 minutes? I'll let Jason take it from here." (one sentence).
- Never use a product name the person would not know (for example "Refactor Sprint"). Describe the work plainly.
- Use "fractional CMO" only if the person's bucket is peer_referral or hiring_path at a company under $50M ARR. Otherwise say "marketing leader" or "CMO".
- Do not overstate the connector's relationship with Jason. If the meeting notes show one conversation, say "we spoke recently", not "I've known Jason for years".
- No flattery of the person being introduced. No "I think you two would really hit it off".
- Hyphens, not em dashes. Plain language. No clever phrasing.`;
