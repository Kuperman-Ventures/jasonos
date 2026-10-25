# Dark Matter Travel Tracker

Family travel board that runs on the JasonOS backend and stays outside JasonOS login.

## Where it lives

- Shareable URL: `/dark-matter` (redirects to the app)
- App: `/projects/dark-matter-travel-tracker`
- Read API: `/api/dark-matter-travel-tracker`

Jason can open it from the locked Projects page. Family members with the URL never see JasonOS chrome, Tell Claude, or other JasonOS pages. Hitting `/today`, `/settings`, or `/projects` still requires Face ID / Touch ID.

## What it stores

Service-role tables in the `jasonos` schema (same arrangement as Ski Tracker):

- `dark_matter_trips`
- `dark_matter_travelers`
- `dark_matter_itinerary_items`

Row Level Security is on. `anon` and `authenticated` have no policies and no grants. The Next.js server is the only reader/writer.

## Access model

Same as Ski Tracker: the URL is public. Anyone who has the link can read and edit trips. They cannot use that access to open JasonOS.

## Isolation checks

- Public prefixes are exact path boundaries (`/projects/dark-matter-travel-tracker-evil` stays locked).
- The public API returns only travel-tracker fields.
- The page does not link to Home, Today, Settings, or other JasonOS tools.
