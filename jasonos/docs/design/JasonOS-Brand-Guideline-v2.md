# JasonOS Brand Guideline v2

v2 change: status is SOLID saturated color, not tints. Color means urgency: the louder the rung, the more it needs action. Type is pushed heavier. Everything not covered under "Urgency system" is unchanged from v1.

JasonOS is a daily operating tool: job search, networking, compliance logging and outbound writing. Screens are dense, repeated and read quickly. This guideline sets one visual language across all of them. Follow it literally.

Base: Broadsheet design system (`styles.css` supplies the color ramps, spacing, radius and shadow tokens). Typeface: Hanken Grotesk, replacing Broadsheet's serif.

## Principles
- **Paper and ink by default.** Light ground, near-black text. Calm until something needs attention.
- **Color means urgency.** Solid magenta, yellow and cyan fills carry status, and the loudest wins. Cyan is also the primary action.
- **Density where needed.** Lists and grids may be tight and ruled. Page structure never is.
- **One typeface.** Hanken Grotesk at a few sizes and weights does all the work.

---

## 01 Color

Never hard-code hex. Use tokens.

| Name | Token | Value / use |
| --- | --- | --- |
| Paper | `--color-bg` | #f3f2f2, page ground |
| Surface | `--color-surface` | #eae9e9, fields, cards, rails |
| Ink | `--color-text` | #201e1d, text, primary rules |
| Muted text | `--color-neutral-700` | #605d5d, secondary text |
| Divider | `--color-divider` | 16% ink, row lines only |
| Cyan | `--color-accent` | #0088b0, icons, focus, fills |
| Cyan 700 | `--color-accent-700` | #006786, links, buttons, text |
| Cyan 100 / 800 | `--color-accent-100` / `-800` | tint fill / text on tint |
| Magenta | `--color-accent-2` | #d6006c, overdue, errors |
| Magenta 100 / 800 | `--color-accent-2-100` / `-800` | tint fill / text on tint |
| Yellow | `--color-process-yellow` | #edbb00, dots, bar segment, 30% tint |
| Calendar | `--color-calendar` | #854ece, meetings, events, dates, availability. 100 #ece2ff, 700 #643b9a |
| Email | `--color-email` | #2d69de, drafts, threads, replies, inbox. 100 #dae9ff, 700 #224fa7 |
| To-do | `--color-todo` | #d55c13, todos, action items, commitments. 100 #ffe0d2, 700 #903300 |
| Done | `--color-done` | #006925, completed, connected, goal met. 100 #d6f0da, 700 #006925 |

### Domain colors
Calendar (violet), email (blue), to-do (orange) and done (green) each own one hue. Use it for the domain's icons, row markers, section kickers, chips, filters and selected states.
- Solid fills take white text, except to-do, which takes ink. Colored text on paper uses the 700 step. 100 steps are for chips and row hover.
- Domain color never signals urgency. An overdue to-do shows a magenta pill next to the orange to-do marker; the loudest rung wins on any pill.
- Done replaces ink for positive completion: done pills, connected dots, goal-met progress bars and the Offer segment.
- Add the matching 100 and 700 steps as tokens beside the existing ramps.

### Urgency system (replaces the v1 status map)

Every status maps to one rung. Rungs 1 to 3 use SOLID fills. Rung 4 is paper, surface or ink.

| Rung | Name | Fill | Text | Used for |
| --- | --- | --- | --- | --- |
| 1 | Act now | Magenta `--color-accent-2` #d6006c | white | Overdue, rejected, failed sync, reconnect needed, errors |
| 2 | Soon | Yellow `--color-process-yellow` #edbb00 | ink | Due this week, no reply 7+ days, caution, sign-in needed |
| 3 | Scheduled / in motion | Cyan 700 `--color-accent-700` #006786 | white | Meetings set, submitted, info banners, primary buttons and links |
| 4 | Calm | Surface `--color-surface` (idle, empty) or Done green `--color-done` #006925 (connected, goal met, done) | ink / white | Connected, goal met, done, idle, empty |

Light cyan (`--color-accent-400`) is used only as the "next steps" segment in the Scoreboard bar.

Rules:
- Solid fills mean status or the primary action. Never decoration or section headers.
- An item with several statuses shows only its highest rung as a pill; the row stays on paper.
- One rung 1 banner per page. Stack lower rungs beneath it. Rung 1 button and rung 1 banner never share a region.
- Colored text on paper uses magenta 700 (#a3004f) or cyan 700. Never yellow text on paper. Never white on yellow.
- Soft tints (100 step) are for row hover and secondary chips only, never for status that needs attention.
- Every pill carries a word; every band a label and count.

## 02 Type

Hanken Grotesk only, weights 400 to 900 (load 400,500,600,700,800,900). Titles and numerals go heavy. No serif, no second family (one exception: the print report, section 08). Tabular numerals for counts, money and dates. Body never below 15px.

| Name | Spec | Example |
| --- | --- | --- |
| Hero numeral | 96/900, -0.04em (64 in dense rows) | 14 |
| Page title | 44/800, -0.03em | Outreach Queue |
| Section head | 26/800, -0.02em | Upcoming meetings |
| Row title | 17/700 | Matthew Deutsch |
| Body | 16/400, line-height 1.5 | Pick a contact, fill the blanks. |
| Secondary | 14/400, neutral 700 | Perlow Productions, Meeting, 1:00 PM |
| Kicker / label | 13/700, +0.14em, caps | CUSTOM COMMS |
| Micro label | 12/600, +0.08em, caps | BROWNING |

## 03 Layout and shape

- **Spacing:** Broadsheet `--space-1` to `--space-8` (5, 10, 15, 20, 30, 40). Section gap 40 to 56. Row padding 12 to 16.
- **Content widths:** forms and reading 760. Standard pages 1200. Board, People and Network Map are full width with 24px padding. Left-align; do not center pages.
- **Radius:** 2px on everything (`--radius-md`). Pills and the tools button are the only exceptions. No rounded 12 to 16px containers.
- **Borders:** no outlines on cards or sections. Permitted: 1px divider between list rows, 2px ink rule over a list header, 1px ink line under the primary nav, 2px ink outline on selected graph nodes.
- **Elevation:** flat by default. `--shadow-sm` on the floating tools button and print sheet. `--shadow-lg` on dialogs and dropdown menus only.
- **Icons:** Phosphor duotone, 20px in rows and nav, 24px in headers. Icon color follows text color, cyan when interactive.
- **Breakpoints:** below 900px the sub-nav scrolls horizontally, master-detail stacks, board columns stack, table rows wrap inline selects onto a second line.
- **Logo:** the play mark stays as is (cyan and ink on paper); 24px in the nav, 40px beside the Home and Settings titles.

---

## 04 Global chrome

### Primary nav
56px tall, paper ground. Brand mark plus wordmark at left, then Home, CoSA, Networking, Job Search, Custom Comms, Projects, Settings (dropdowns use Phosphor caret-down), Sync at right. Items 16/500 ink. Active section: surface fill, weight 600. Sync is the only outlined button in the bar and shows a spinning icon while running. Bottom edge is a 1px ink line, the one permitted global rule.

### Section sub-nav (Networking example)
Dashboard, Queue, People, Network Map, Suggested (count badge), Sent, Firms. 48px tall, icon plus label, 15/500. Active tab: weight 600 and a 3px cyan underline. Count badge: ink pill with paper text. Same pattern serves the CoSA tabs (Dashboard, All Activity, Log Work Search, NYUI external link, Log Business Hours). External links carry an arrow-square-out icon.

### Floating tools button
Fixed to the right edge, vertically centered, 48px ink circle. The only circular control and, with dialogs, the only elevated element. Must not cover content: keep 72px right padding on pages at narrow widths.

## 05 Page skeletons

Pick one. Do not invent a fourth.

**A. Single column (760 to 1200 max).** Optional kicker (13/600 caps, cyan 700, section icon at left). Title 36/700. Description 17/400 neutral 700, max 65 characters per line, one to three lines. Optional actions right-aligned on the title baseline. Content starts 32px below. Used by: Home, CoSA pages, Job Alerts, Scoreboard, Settings, Email, Resume Customizer, Post Master, Suggested, Dashboard, Weekly report.

**B. Master-detail.** Rail 320px fixed at left, detail fluid at right, 40px gap. Rail scrolls independently; selected row uses surface fill and weight 600, no border. Primary action pinned at rail foot (Generate prep). Used by: Interview Prep, Browning Networking (rail groups: To reply, Waiting for them to schedule, Meeting set), Network Map (detail panel at right, 360px).

**C. Board (full width, 3 columns).** Only Outreach Queue. Three equal columns (Network Growth, Network Maintenance, Cold), 16px gap, page padding 24px. Each column header: name, count, one-word purpose in caps. Columns stack when narrow.

---

## 06 Components

### Buttons
- Primary: cyan 700 fill, white text, 600. Hover cyan 800. One per view region, bottom-right of its form or header right.
- Secondary: 1px ink outline, 500.
- Ghost link: cyan 700, underlined.
- Icon button: 40 x 40.
- Destructive: magenta 700 fill, used only in confirmations. Trash icons in rows are ghost icon buttons that turn magenta on hover.
- Disabled: 45% opacity.
- Radius 2px. Height 40px default, 32px in dense rows (Open, Draft email, Text, Log, Reconnect).
- Pending: label becomes spinner plus verb ("Syncing..."), width held.

### Form fields
- Surface fill, 2px neutral 400 bottom edge, no full border. Padding 11px 14px.
- Label above, 14/600. Required marker is a magenta asterisk. Helper text 13/400 neutral 700 below.
- Focus: 2px cyan outline, 2px offset.
- Error: magenta 100 fill, 2px magenta bottom edge, 13px magenta 700 message below.
- Textareas (job description, idea input, thank-you notes): same fill, min-height 160px, resize vertical.
- Date fields: calendar icon at right. Search fields: magnifier at left, 40px tall.
- Inline selects in table rows (A/B/C, 1/2/3, Intent, Cadence, Classification): 32px, 13/500, always-visible caret.
- Long forms (Log Work Search): one column, 640px max, 20px between fields.

### Segmented control, chips, stepper
- Selected = ink fill with paper text. Unselected = surface fill.
- Segmented control switches views within a page (Templates / Email Builder, Quick idea / Research a topic).
- Filter chips show counts (All 216, Recruiter 11). Pill-shaped: the one place a large radius is allowed.
- Stepper (Email flow, Post Master Idea/Voice/Hooks/Output): 24px numbered circles. Current = ink, upcoming = surface, completed = ink with check. Post Master's mono numbered stages become this stepper.

### Tags and status pills
- **Status pills:** SOLID, 14/700, caps, radius 2px, padding 3px 12px. Fill and text per urgency rung (e.g. 56 DAYS OVERDUE magenta, DUE IN 3 DAYS yellow, SCHEDULED OCT 5 cyan, CONNECTED ink, Idle surface).
- **Tier codes** (A1, B2, C3): outlined 1px neutral 500, 14/600. Never colored, so they do not compete with status.
- **Classification tags** (Recruiter, Operator peer, Mentor): surface fill, ink text. Prospect uses ink outline. Classification never uses rung colors.
- **Caps micro-labels** (BROWNING, MAINTENANCE, GROWTH): 12/700 tracked, no fill.

### Notices and banners
Full-width SOLID bands, padding 14px 20px, weight 600, no border, no left stripe. Magenta = failure, yellow = caution, cyan 700 = information, surface = neutral or success (ink dot). Optional Phosphor icon at left; dismissible ones add a close icon at right. One rung 1 banner per page.

### Stats, progress, pipeline
- Stat block is unboxed: 13/700 caps label, 96/900 numeral (64 in dense rows or four-plus across), one caption line.
- The numeral takes its rung: magenta 700 text (overdue), yellow highlight block with ink numeral (due soon), cyan 700 text (scheduled), ink (calm, totals).
- Goal progress: 8px ink bar on a surface track (full green = goal met).
- Pipeline bar (Scoreboard): 12px tall, no gaps, SOLID segments in rung colors (Submitted cyan 700, No reply yellow, Next steps cyan 400, Rejected magenta, Offer done green), click to filter.

### Cards, list rows, tables
- **Cards:** surface fill, no border, radius 2px, 16px padding. Only for discrete items (integration accounts, revenue tiles, email template options, suggested contacts). Never nest cards. Never use a card as a page section.
- **Rows:** separated by 1px divider lines inside lists and tables only. A list with a column header starts with a 2px ink rule. Row height 56 to 72px. Primary text 16/600, secondary 14/400 neutral 700, meta at right.
- **Links in rows:** cyan 700, underlined, with an external icon when they leave the app.
- **Dense grids (People):** one row per person with inline selects on a shared fixed-width column grid so selects align. Column labels 12/600 caps above the first row only.

### Expandable sections and empty states
- Accordion: title row with caret at right; open state rotates the caret and reveals content with no border box (Recent tailored resumes, Live Data Preview).
- Empty state: one plain sentence, italic in queue buckets ("No contacts in this bucket."), or on a surface strip in rails ("Nobody left to reply to."). No dashed outlines, no illustrations.
- Loading: same layout with surface-colored skeleton bars.

### Queue status bands
Column headers are SOLID full-width bands: 800 caps label at left, count at right (22px). Engaged Today = ink, Overdue = magenta, Due This Week = yellow (ink text), Scheduled = cyan 700. Rows below stay on paper with a matching small solid pill at right (56D, 3D, OCT 5). Empty state under a band: italic "No contacts in this bucket." Home follow-up groups (Email follow-ups, Due This Week, Overdue) use the same solid headers.

### Buttons (urgency variants)
Default primary is cyan 700. Magenta or yellow solid buttons replace the primary only when the action resolves an urgent or soon item (Reconnect Outlook, Follow up today). Never both in one region. Ink solid = "Mark done". Weight 700.

---

## 07 Screen recipes

**Home** (`/`, A). Morning Brief and Inbox Dispatch as collapsed rows with count pills and Refresh. Email follow-ups, Due This Week and Overdue are lists under band headers (cyan, yellow, magenta tint). Each row: tier tag, name, firm, cadence micro-label, due phrase as status text, four 32px buttons: Open, Draft email, Text, Log. Snooze controls (1 day, 3 days, 5 days, Days field, Set, Done) are secondary buttons; Done is primary.

**CoSA, Dashboard** (`/nyui`, A + tabs). Tabs: Dashboard, All Activity, Log Work Search, NYUI (external), Log Business Hours. Audit Report is a secondary button with document icon. Work Search Progress: ink goal bar, two stat blocks for Tier A and Tier B, then a row list with date, company, tier tag, role, outcome status text.

**CoSA, All Activity** (A). Search field, then one section per claim week. Week heading 22/600 with a THIS WEEK ink pill, Goal Met status, Add application and Add hours secondary buttons. Row actions (Edit, Add follow-up, Delete) are ghost links with icons; Delete turns magenta on hover. Result pills: Rejected magenta solid, Application Submitted cyan solid.

**CoSA, Log Work Search** (A form). Single 640px column. Quick-log secondary full-width button on top. Required fields carry the magenta asterisk; date has calendar icon; helper text under Activity Tier explains Tier A and B.

**Networking, Dashboard** (`/outreach/dashboard`, A). Three unboxed stat blocks, then two columns: Fresh outreach and Upcoming meetings, each a list with cyan 700 linked names, BROWNING micro-label, date at right. Header actions: Previous week, Next week (disabled at 45%), Open print report.

**Networking, Queue** (`/outreach/queue`, C). Kicker with icon, title, Add contact secondary button, search, count line (ink numerals, no color). Three columns with solid status bands; contact rows with tier tag, firm, date and signal dot. Column header is a surface strip with icon, name, count, caps purpose.

**Networking, People** (`/outreach/people`, A wide). Search, Sort select, chip filter row with counts, Run Tier 1 Ranker secondary button, "216 of 216 shown" at right. Each row: name, tier tag, VIP star (cyan), classification tag, subline, five inline-select columns (A/B/C, 1/2/3, Intent, Cadence, Classification), mail icon, Open button.

**Networking, Network Map** (`/outreach/network-map`, B). See section 08.

**Networking, Suggested** (`/outreach/suggested`, A). Short description, Two-way only filter chip with count, "7 suggested". Each suggestion is a row card: name, TWO-WAY cyan tag, source line with mail and building icons, quoted subject in italic, sent and received counts, Add (secondary with icon), dismiss ghost icon.

**Networking, Browning** (`/outreach/browning-networking`, B). Rail groups TO REPLY, WAITING FOR THEM TO SCHEDULE, MEETING SET, each a 13/600 caps label with count. Selected person on surface fill. Detail: name, contact line, LinkedIn link, quoted reply, Meeting set surface panel, After the call section with buttons, a textarea, Write thank-you draft button, Keep in touch select with Save.

**Job Search, Scoreboard** (`/scoreboard`, A). Pipeline stat strip on a surface band with dot-labelled counts (Submitted, No reply, Next steps, Rejected, Offer) and a status segment bar. Search field at right of the Submitted Applications heading. Application rows show five status dots at right; the active one is a larger ringed dot in its signal color, the rest neutral 300.

**Job Search, Job Alerts** (`/job-alerts`, A). Icon tile header with Sync job alerts button. Sync result is a surface notice with success dot and detail lines. Opportunities list: company 16/600, role as cyan link with external icon, salary in ink 14px, date and trash ghost icon at right. Count summary at right of the section head as plain text.

**Job Search, Interview Prep** (`/interview-prep`, B). Rail lists resumes with company, role, date, version, match percent; selected row on surface fill. Generate prep is the pinned primary button. Detail: caps label OPEN WITH, body paragraph, Company intel section with icon and numbered points. "Use it:" lines are 14px with the lead word in 600. Download PDF is secondary at right.

**Custom Comms, Email** (`/email-templates`, A). Segmented control (Templates / Email Builder), 4-step stepper, then two-column grid of template cards: OPTION 01 caps label, title 17/600, description, Subject line 14px. Custom-field count is a small surface tag.

**Custom Comms, Resume** (`/resume-customizer`, A). Numbered section with large textarea, Upload PDF / Word secondary button, Customize & download primary with arrow. Core resume status is a surface pill with success dot. Recent tailored resumes is an accordion; rows have file icon, name, meta, edit, Resume and JD download links, trash.

**Custom Comms, Post Master** (`/post-master`, A). Drops its dark mono treatment. Kicker, 44/700 title, description, project title field with Open, New, Save project (primary), UNSAVED DRAFT status text, stepper for Idea, Voice, Hooks, Output, Start section with two-option segmented control and textarea.

**Settings** (`/settings`, A). Logo tile beside title. Yellow solid notice band, then health strip with success icon, "10 of 16 services connected" and Check All secondary. Mail accounts is one section with three account cards (name, connected pill, address, sign-in message, Reconnect ghost link). Live Data Preview uses two collapsible cards. Connected Services is a two-column card grid with icon, name, connection type, connected pill at right.

---

## 08 Graphs and print

### Network Map
- Canvas is paper ground. Nodes are paper-filled rectangles: 13/600 name over 11/400 firm.
- 2px outline by degree: You = ink fill; 1 (know well) = ink; 2 (intro'd by a 1) = cyan; 3 (intro'd by a 2) = yellow. Channel nodes = surface fill, dashed neutral 600 outline.
- Referral lines: cyan 600, 1.5px, with arrowheads. Known or via-channel lines: dashed neutral.
- Selected chain at full opacity; everything else drops to 25%.
- One toolbar above the canvas: search, DEG and TIER segmented controls, zoom icons, Clear, Reset layout. Legend below.
- Side panel: caps stat labels with 32/700 numerals, then plain help text.

### Weekly report (print)
Printed-paper context. Paper ground, ink text. The only place a serif and thick-thin ink rules are allowed: Source Serif 4 as today, with masthead line, dateline rail, three stat columns and two-column lists. The on-screen Dashboard uses standard sans components and does not imitate the report. Buttons above the sheet (Previous week, Next week, Download PDF) use standard styles on a surface ground, sheet raised with `--shadow-sm`. Minimum 12pt in print.

## 09 Interaction

- **Hover:** buttons and links step one shade darker along the cyan ramp (600 to 700, 700 to 800). Rows gain a 50% surface tint. Ghost icons turn ink.
- **Pressed:** one more ramp step darker; no scale or shadow change.
- **Focus:** 2px cyan outline, 2px offset, on every interactive element via `:focus-visible`. Never the browser default ring or a white ring.
- **Selected:** ink fill with paper text for chips and segmented options; surface fill with weight 600 for list and rail items; 3px cyan underline for tabs.
- **Disabled:** 45% opacity, no pointer events (Next week on the latest week).
- **Loading and errors:** buttons show spinner and progressive verb. Lists show skeleton bars in surface color. Errors appear in a magenta-tint banner at the top of the affected section with a retry link.

## 10 Rules for the implementer

**Always**
- Reference tokens (`var(--color-*)`, `--space-*`, `--radius-*`), never raw hex.
- Use Hanken Grotesk with tabular-nums on counts, money and dates.
- Choose one of the three page skeletons for every new page.
- Pair every color signal with a text label so meaning survives without color.
- Use solid status fills per the urgency ladder: white text on magenta and cyan 700, ink on yellow.
- Use Phosphor duotone icons at 20 or 24px.

**Never**
- No gradients or glows. Solid color is for status only; never tint-only status. (A dark hero band on the guideline document itself is allowed; the app stays light.)
- No green, orange or blue outside the urgency ladder.
- No left-border accent stripes, no cards inside cards, no rounded containers above 2px.
- No mono or serif faces outside the print report.
- No yellow text or hairlines on paper.
- No second primary button in a view region.

## 11 Token sheet

```css
:root {
  --jos-bg: var(--color-bg);            /* #f3f2f2 */
  --jos-surface: var(--color-surface);  /* #eae9e9 */
  --jos-ink: var(--color-text);         /* #201e1d */
  --jos-muted: var(--color-neutral-700);
  --jos-line: var(--color-divider);
  --jos-action: var(--color-accent-700);
  --jos-action-hover: var(--color-accent-800);
  --jos-focus: var(--color-accent);

  --jos-ok: var(--color-text);
  --jos-info: var(--color-accent-700);  /* rung 3 solid, white text */
  --jos-warn: var(--color-process-yellow);
  --jos-danger: var(--color-accent-2);
  --jos-danger-text: #a3004f;  /* magenta 700 for text on paper */
  --jos-hover-tint: var(--color-accent-100);

  --jos-font: 'Hanken Grotesk', system-ui, sans-serif;
  --font-heading: var(--jos-font);  /* override Broadsheet serif */
  --font-body: var(--jos-font);
  --jos-radius: 2px;
  --jos-nav-h: 56px;
  --jos-subnav-h: 48px;
  --jos-rail-w: 320px;
}
body { font: 400 16px/1.5 var(--jos-font); background: var(--jos-bg); color: var(--jos-ink); }
:focus-visible { outline: 2px solid var(--jos-focus); outline-offset: 2px; }
```
