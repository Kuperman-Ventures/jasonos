# Dark Matter Travel Tracker

IUGR Entry 02. An interactive explainer of travel paths, characters, and worlds in *Dark Matter*, running on the JasonOS backend and staying outside JasonOS login.

## Where it lives

- Live experience: [`/iugr/dark-matter`](/iugr/dark-matter)
- Shareable aliases: `/dark-matter` and `/projects/dark-matter-travel-tracker` redirect there
- Series home (Entry 01): [`/iugr`](/iugr)

Family members with the URL never see JasonOS chrome, Tell Claude, or other JasonOS pages. Hitting `/today`, `/settings`, or `/projects` still requires Face ID / Touch ID. Dark Matter links back to Entry 01, not to JasonOS home.

## What it is

A spoiler-aware subway map through season 2 episode 9. Worlds are columns in story order. Each character version is a lane. Step through the story, trace one path, or click a world to read it.

Content lives in [`lib/dark-matter-explainer/data.json`](../lib/dark-matter-explainer/data.json).

## Access model

Same as the rest of IUGR: the URL is public. Anyone who has the link can read it. They cannot use that access to open JasonOS.

## Isolation checks

- Public prefixes are exact path boundaries (`/iugr` covers this entry; `/projects/dark-matter-travel-tracker-evil` stays locked).
- The page does not link to Home, Today, Settings, or other JasonOS tools.
