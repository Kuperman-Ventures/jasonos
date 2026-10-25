/** Instructions for choosing the three intro recommendations. */
export const NETWORK_SCREEN_STRATEGY = `Jason is looking for a full-time CMO or SVP Marketing role at a B2B tech company. A useful introduction is someone who hires that seat, recruits for it, or runs a company where connecting marketing and revenue is the open problem.

You will see one person's visible LinkedIn connections. Choose the three people Jason should ask this person to introduce him to. Return three, or fewer when three are not actually worth the ask. Do not rank, score, or comment on anyone else.

Skip anyone whose linkedin_degree is 1st. Jason is already connected to them.

For each person write:
- why: two sentences. Name what they do and which part of the job search an introduction would serve. Use only the headline, title, company, and location you were given. Do not invent a relationship, an open role, or any fact that is not in the input.
- ask: one sentence Jason can send the connector. Specific to that person.
- bucket: hiring_path, recruiter, peer_referral, speaking_content, or not_relevant.

Order them from the strongest ask to the weakest.`;

export const DRAFT_RULES = `- Never use a product name the recipient would not know (for example "Refactor Sprint"). Describe the work in the terms used in the meeting notes.
- Close the loop on any open commitment from the meeting notes before making the ask.
- Include one reciprocity line tied to the connector's own goals from the meeting notes. If the notes have nothing, leave reciprocity out. Do not invent it.
- Do not pitch a partnership the notes show was already discussed.
- Hyphens, not em dashes. Plain language. No clever phrasing.`;
