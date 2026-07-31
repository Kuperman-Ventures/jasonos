# Morning Brief publisher (Claude → Supabase)

Claude (or a scheduled job) writes one row per weekday into
`public.morning_briefs`. JasonOS Home reads that row and lays it out.

## Links in summaries

JasonOS will render markdown links and bare URLs as clickable opens-in-new-tab
links in Email by Group, Newsletter digest, Calendar, and Needs your attention.

**Today’s published briefs contain no URLs** — the publisher must include them.

Add something like this to the Claude publisher prompt:

> For every email or newsletter item you summarize that has a useful link
> (Gmail message/thread, article URL, LinkedIn post, calendar event), include
> it inline as a markdown link on that item, e.g.
> `- [AI Visibility Pulse](https://…)` or
> `HubSpot delete request ([open in Gmail](https://mail.google.com/mail/u/0/#all/THREAD_ID)).`
> Prefer the article/source URL for newsletters and a Gmail thread permalink
> for actionable inbox items. Skip tracking/unsubscribe links.

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

Suggested section shape (unchanged):

```md
## Email by Group
**Job search — ~10 unread.** …
**Admin / finance — 2 unread.**
- HubSpot delete request ([open](https://mail.google.com/…))

## Newsletter Digest
**AI and Marketing**
- [AI Visibility Pulse](https://example.com/article) — relevant to Peec.ai today
```
