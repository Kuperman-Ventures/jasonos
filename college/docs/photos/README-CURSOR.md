# Cursor Handoff - Photos Tab and Visit Planning Tab

Start with this file. It sets the build order, the data to import, and the changes to the design references. Where this file and another file in this folder disagree, this file wins.

## Files In This Folder

| File | What it is |
|---|---|
| `README-CURSOR.md` | This file. Build order, data import, and changes to the design references. |
| `design/the-track-design-guidelines.md` | Site-wide design system: tokens, type, dark mode, components. |
| `design/design-guidelines.md` | Design rules specific to the Photos and Visit planning tabs. Where it differs from the site-wide file, this tab file wins for these two tabs. |
| `design/design-cursor-prompt.md` | The designer's build spec for both tabs. Follow it, with the changes listed below. |
| `reference/photos.html` | Working reference for the Photos tab and viewer. Updated to use real Purdue photos and the attribution rules below. |
| `reference/visit-planning.html` | Working reference for the Visit planning tab. All data in it is sample data. |
| `reference/photo-set-preview.jpg` | Preview of the 40 imported school photos, for checking the import. |
| `data/school-photos-test.json` | School photos and virtual tour links for 5 schools. |

The site-wide design file mentions `Prep Portal - Design System.dc.html`, `assets/logo.png` and `handoff-requirements/requirements.html`. They are not in this folder. Use them if they are already in the repo; otherwise ignore those references.

The references load Phosphor icons from a CDN. Use the app's existing icon setup, and add the Phosphor package if the app does not have it.

## Build Order

1. Build the Photos tab (Step 1). Stop and report back when it is done.
2. Do not start the Visit planning tab (Step 2) until I confirm Step 1 works.

## Step 1 - Photos Tab

### 1.1 Import the school photo data

1. Find where the app stores school records (the same data file, seed, or database table that holds `aerospaceEngineering`). Match records to `data/school-photos-test.json` by the exact school name in the `school` field.
2. Add `virtualTourUrl` (string or `null`) to every school record. Set it for the 5 schools in the file and leave it `null` for the other 38.
3. Store each school photo as a photo row using the data model in `design/design-cursor-prompt.md`, with `kind: 'school'`. Map the JSON fields like this:

| JSON field | Photo field | Use |
|---|---|---|
| `fullUrl` | `src` | Image in the viewer |
| `thumbUrl` | `thumbSrc` (new) | Image in the grid and filmstrip |
| `caption` | `caption` | Caption in the viewer |
| `credit` | `credit` (new) | Photographer name |
| `license` | `license` (new) | License name, for example `CC BY-SA 4.0` |
| `licenseUrl` | `licenseUrl` (new) | Link to the license text, or `null` |
| `sourceUrl` | `sourceUrl` (new, replaces `source`) | Link to the photo's page on Wikimedia Commons |

4. Keep the photos in the order they appear in the JSON.
5. Load images directly from the URLs. Do not download or store copies of the images.

### 1.2 Build the tab

Build the Photos tab from `design/design-cursor-prompt.md` section 1 and `reference/photos.html`, with these changes:

1. **Attribution in the viewer.** For school photos, the meta line under the caption reads `Photo: {credit} · {license} · View source`. The license name links to `licenseUrl` when it is not `null`. "View source" links to `sourceUrl`. Both links open in a new tab. This replaces `Source: {domain}` in the design spec. The photo licenses require this credit, so it cannot be removed.
2. **Attribution note.** Under the school photo grid, show one line in small subtle text: `Photos from Wikimedia Commons. Credits appear when a photo is opened.` Hide it when the school has no school photos.
3. **Virtual tour link.** In the "From {School}" section heading, show `Virtual tour ↗` to the left of the photo count, as an accent-colored text link that opens `virtualTourUrl` in a new tab. It is a link, not a button, so the tab keeps a single primary action. Hide it when `virtualTourUrl` is `null`.
4. **Image sizes.** The grid and filmstrip use `thumbSrc`. The viewer uses `src`.
5. **No school photos.** Show `No school photos yet.` (from the design spec). The virtual tour link still shows if the school has one.
6. **Family photo uploads.** Store uploads with the same storage and user/school tagging the app uses for Notes. If the app has no file storage for uploads, build everything else in this step, leave the upload handler unconnected, and tell me what storage is needed. Do not add a new storage service without asking.
7. **Demo switch.** Remove the Light/Dark demo switch from the reference. The app's Appearance setting drives the mode.

### 1.3 Confirm before reporting back

1. The 5 schools in the JSON each show 8 school photos (40 total). The other 38 schools show `No school photos yet.`
2. Every school photo opens in the viewer with its caption and credit line, and the license and "View source" links work.
3. The virtual tour link shows for the 5 schools and opens in a new tab.
4. The viewer works with the arrow buttons, the left and right arrow keys, the mouse wheel, swipe on a phone, and the filmstrip. Escape closes it and returns focus to the photo that opened it.
5. The tab looks right in Light, Dark and System mode, following the checklist in `design/the-track-design-guidelines.md` section 2b.
6. Below 700px wide, the side arrows are hidden and swipe works.

## Step 2 - Visit Planning Tab

Build from `design/design-cursor-prompt.md` section 2 and `reference/visit-planning.html`, only after I confirm Step 1.

Before writing any code for Step 2, report which of these already exist in the app:

1. Kyle's interest level for each school (the Interest picker).
2. A source for drive times between schools.
3. The student's current phase, used for the trip window.
4. The Calendar and To-Do features that "Send to Calendar" writes to.

Do not hard-code the sample Los Angeles schools, drive times or tour times from the reference. The open questions at the end of `design/design-cursor-prompt.md` still need answers before this tab can use real data.
