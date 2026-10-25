/** Scoring instructions. Used verbatim as the model system prompt. */
export const NETWORK_SCREEN_STRATEGY = `Targets: full-time CMO or SVP Marketing roles at B2B tech companies; fractional CMO clients at $2M-$50M ARR; executive recruiters; PE/VC operating partners.

Buckets:
- hiring_path: CEO or founder of a B2B SaaS or tech company in the ICP, or a PE/VC partner with portfolio companies.
- recruiter: executive or technical search firm.
- peer_referral: CMOs, fractional executives, positioning consultants who could refer work or share market intel.
- speaking_content: people connected to conferences, CMO networks, or publishing. Relevant to speaking positioning, not the job search.
- not_relevant: everyone else.

Tiers:
- tier1: ask the connector for an intro. Needs a one-line "why" and a one-line "ask".
- tier2: go direct, or hold. Anyone already a 1st-degree connection of Jason's is tier2 with next action "Reactivate directly". Never tier1.
- none: not shortlisted.

The connector gets a partner_note if their own work is adjacent to Jason's (referral partner, not only a source of intros).`;

export const DRAFT_RULES = `- Never use a product name the recipient would not know (for example "Refactor Sprint"). Describe the work in the terms used in the meeting notes.
- Close the loop on any open commitment from the meeting notes before making the ask.
- Include one reciprocity line tied to the connector's own goals from the meeting notes. If the notes have nothing, leave reciprocity out. Do not invent it.
- Do not pitch a partnership the notes show was already discussed.
- Hyphens, not em dashes. Plain language. No clever phrasing.`;
