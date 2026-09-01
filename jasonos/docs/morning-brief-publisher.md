# Morning Brief publisher (Claude → Supabase)

Claude (or a scheduled job) writes one row per weekday into
`public.morning_briefs`. JasonOS Home reads that row and lays it out.

## Links in summaries

JasonOS will render markdown links and bare URLs as clickable opens-in-new-tab
links in Email by Group, Newsletter digest, Calendar, and Needs your attention.

**Today’s published briefs must include URLs** — JasonOS will render them, and
will drop any destination it cannot match to the article or email.

Add something like this to the Claude publisher prompt:

> For every email or newsletter item you summarize that has a useful link
> (Gmail message/thread, article URL, LinkedIn post, calendar event), include
> it inline as a markdown link on that item, e.g.
> `- [AI Visibility Pulse](https://…)` or
> `HubSpot delete request ([open in Gmail](https://mail.google.com/mail/u/0/#all/THREAD_ID)).`
> Prefer the article/source URL for newsletters and a Gmail thread permalink
> for actionable inbox items. Skip tracking/unsubscribe links.
>
> Newsletter digest items must link to the **article page that matches the
> title**. Do not use a newsletter-issue landing page (`/issues/…`), a Gmail
> permalink, a Google redirect (`google.com/url`, news.google.com), or one URL
> reused across two different headlines. If you do not have the matching
> article URL, leave the title unlinked — JasonOS will show the title and
> summary with no "Open article" control.

**JasonOS will not invent a link.** Digest "Open article" only fires when the
URL looks like a real article page. Gmail, calendar, and Zoom links still
work in Email / Calendar / Needs your attention. Newsletter-issue pages,
Google error/redirect URLs, and Gmail pasted onto a digest story are shown
as plain text.

**Gmail links open the specific thread.** JasonOS normalizes any
`mail.google.com` link at render time so it opens the exact conversation in the
right mailbox:

- the `u/0` account *index* is rewritten to `u/<account-email>` (set via
  `GMAIL_ACCOUNT_EMAIL` / `NEXT_PUBLIC_GMAIL_ACCOUNT_EMAIL`), which fixes
  "opens Gmail but not the email" when several Google accounts are signed in, and
- single-view hashes like `#inbox/<id>` are promoted to `#all/<id>` so archived
  or labeled threads still resolve.

Publisher tip: always include the Gmail **thread id** in the hash
(`#all/<THREAD_ID>` or `#inbox/<THREAD_ID>`). A bare `mail.google.com/…#inbox`
with no id can't be deep-linked to a specific message.

## Newsletter Digest buckets

Home always shows three newsletter columns, in this order:

1. Marketing and advertising
2. AI in general
3. AI in marketing and advertising

Use those exact `###` headings. Each bullet is **one story**: markdown link,
em-dash, then a **multi-sentence summary** (roughly 2–4 sentences — the card
shows only the first sentence as a teaser; click opens the full summary in a
modal). Always put the **article URL on the title link**, not buried only in
the summary body, so Home can offer “Open article in browser.” If the matching
article URL is not in the source email, omit the markdown link entirely.

Older publisher headings still map:

- `Marketing and Media News` / `Marketing & Media News` → Marketing and advertising
- `AI and Business` → AI in general
- `AI and Marketing` / `AI & Marketing` → AI in marketing and advertising

Suggested section shape:

```md
## Calendar Today
- **10:00–11:00 AM** — [Jason K](https://www.google.com/calendar/event?eid=…) — with jerry@. Job search.
- **3:00–3:45 PM** — [Richard/Jason Catch Up](https://www.google.com/calendar/event?eid=…) — Zoom. Network/BD catch-up.
```

Bold **only the time**. Put the event title in a markdown link, then an em-dash, then the notes. Home shows time | title | notes as three distinct pieces.

Google Calendar `eid` values contain a space (`eventId calendarId`). Leave that space in the markdown URL — JasonOS encodes it. Do **not** paste the raw calendar URL as visible text.

Also accepted (older publisher shapes):

- Time and title both inside the bold: `**10:00–11:00 AM — [Title](url)** — notes`
- Unbolded: `8:00–10:00 AM — [Title](url) — notes`

Housekeeping / duplicate-event notes go as a paragraph under the bullets, not as another bullet.

Suggested section shape for email + digest:

```md
## Email by Group
**Job search — ~10 unread.** …
**Admin / finance — 2 unread.**
- HubSpot delete request ([open](https://mail.google.com/…))

## Newsletter Digest

### Marketing and advertising
- [Holdco H1 earnings compared](https://example.com/article) — Publicis and Omnicom pulling away; WPP slowed its decline.

### AI in general
- [Anthropic revenue on track to exceed $65B](https://example.com/article) — 7x its pace at the end of last year.

### AI in marketing and advertising
- [AI Visibility Pulse](https://example.com/article) — relevant to Peec.ai today. Category eligibility inside the model now outranks SEO rank.

## Job Alerts: $300K+ Roles
- [Chief Marketing Officer — Ladders: up to $450K/year](https://www.linkedin.com/jobs/view/123456)
- [VP Marketing — Indeed: up to $325K/year](https://www.indeed.com/viewjob?jk=…)
```

The **Job Alerts** page no longer reads this section. It harvests listings
directly from a Gmail folder on a weekday cron (see
`/api/job-alerts/harvest`). You can still include a Job Alerts H2 in the
brief for the home-page summary; it is optional.

**Link preference (deepest wins):** use the **job listing URL** (LinkedIn /
Indeed / Greenhouse / Lever / etc.) when the alert contains one. Fall back to a
Gmail thread permalink (`#all/<THREAD_ID>`, not a message id) only when no
posting URL is available. JasonOS will also try to extract the listing from the
Gmail alert when only a mail link is published.
