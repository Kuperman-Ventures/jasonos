# Trailbound AT

## Cursor build brief for an adaptive Appalachian Trail readiness planner

Build a polished, local-first web application called **Trailbound AT**. Its purpose is to help one person move safely and realistically from their current health, fitness, schedule, finances, and outdoor experience to completing the Appalachian Trail—either as a thru-hike or in sections.

This is not a generic task manager and not a fixed countdown. It is an adaptive readiness system. It should show the whole journey, but make the next useful action unmistakable. It should revise its forecast when the user's life or readiness changes, without presenting a delayed forecast as failure.

---

## 1. Product idea

### Problem

Preparing to complete the Appalachian Trail is a multi-year, cross-domain project. A calendar-only roadmap creates false precision: health, available time, recovery, skills, gear, finances, family responsibilities, weather, permits, and field-test results interact. The user needs a system that converts the ambition into safe, manageable work while retaining the ability to pause, re-plan, or switch between thru-hiking and section hiking.

### Product promise

**See the whole mountain. Work the next blaze.**

At any moment, the app answers five questions:

1. Where am I now?
2. What is the single best next action?
3. Why is that action next?
4. What evidence would show I am ready to advance?
5. What has changed in the forecast?

### Success outcomes

- The user completes a useful baseline assessment in under 20 minutes.
- The app produces an immediately usable first 14-day plan.
- Every milestone has a definition of done or attached evidence.
- The user can miss weeks, pause, or change strategy without corrupting the plan.
- The start window is derived from readiness and constraints, not chosen as an arbitrary motivational deadline.
- Safety gates cannot be silently bypassed; overrides require a reason and remain visible.

### Non-goals for v1

- Do not diagnose illness, prescribe treatment, or replace a clinician.
- Do not provide live navigation or serve as an emergency beacon.
- Do not build a social network, coaching marketplace, or public leaderboard.
- Do not optimize daily on-trail mileage in v1.
- Do not scrape permit systems or treat permit rules as permanently correct.

---

## 2. The smarter planning model

Use three layers rather than one long checklist.

### Layer A — North Star

The user's goal record:

- completion definition: thru-hike, section hike, or undecided
- direction: northbound, southbound, flip-flop, or undecided
- desired experience and personal reasons
- earliest feasible start window, never a forced date
- acceptable duration away from home
- non-negotiables and deal-breakers
- strategy history, so a change of plan is recorded as adaptation rather than failure

### Layer B — Readiness lanes

Show nine lanes, each with a 0–4 stage and a confidence label:

1. **Health & recovery**
2. **Aerobic base & strength**
3. **Hiking durability**
4. **Backcountry skills & safety**
5. **Gear system**
6. **Field validation**
7. **Money & resupply**
8. **Work, home & relationships**
9. **Route, rules & launch logistics**

Lane stages:

- 0 — unknown
- 1 — baseline established
- 2 — foundation in progress
- 3 — demonstrated in realistic conditions
- 4 — launch ready

Never average safety-critical lanes into a misleading overall score. The overview may show “6 of 9 lanes on track,” but launch readiness requires every critical gate to pass.

### Layer C — Current focus

Generate a rolling plan with:

- **One primary action**
- up to **three supporting actions**
- one optional “low-energy win”
- a weekly workload budget
- an explicit reason for each recommendation

The system should reduce concurrent work. Default work-in-progress limit: 4 active actions.

---

## 3. Planning principles

1. **Readiness before dates.** Dates are forecasts produced by gates, capacity, season, and constraints.
2. **Evidence before confidence.** A completed checkbox is weaker than a logged hike, shakedown report, clinician note, receipt, or contingency drill.
3. **Progressive exposure.** Day hike → back-to-back day hikes → overnight → multi-night → extended shakedown.
4. **Load and recovery count together.** Training completion without symptoms, sleep, and recovery context is incomplete.
5. **Specificity increases over time.** Early planning uses ranges. Detailed bookings and final purchases happen only when the relevant choices stabilize.
6. **Re-planning is normal.** Every forecast change gets an explanation, not a red warning.
7. **Current rules expire.** Permit, closure, fee, and access notes have `verifiedAt`, `sourceUrl`, and `recheckBy` fields.
8. **Section hiking is a first-class success path.** It is not presented as a lesser fallback.

---

## 4. Onboarding and baseline

Use a conversational, save-as-you-go wizard. Every question supports “I don't know yet.” Sensitive health fields are optional and stored locally by default.

### Step 1 — Define the dream

- What does “walk the Appalachian Trail” mean to you?
- Thru-hike, complete in sections, or explore both?
- Why does this matter?
- What would make the experience successful even if the original format changes?
- Preferred direction or season, if any?

### Step 2 — Health and access baseline

- Age band (optional)
- Current conditions, injuries, pain, mobility constraints, medications, allergies, and prior surgeries (all optional free text)
- Current care team and whether a clinician has advised on strenuous backpacking
- Red-flag symptoms or reasons to seek medical advice before increasing activity
- Accessibility needs
- Current sleep and recovery confidence

Show this persistent note: **“Trailbound organizes preparation; it does not provide medical clearance. If you have symptoms, a significant condition or injury, or uncertainty about strenuous exercise, review the plan with a qualified clinician before increasing training.”**

Do not generate prescriptive exercise intensity from diagnoses. If health uncertainty is material, create a gate called **Agree on safe activity boundaries with a qualified clinician** and allow low-risk research/planning tasks to continue.

### Step 3 — Current activity and experience

- Typical weekly walking/hiking minutes and elevation
- Longest recent walk/hike, longest recent back-to-back days
- Strength and mobility routine
- Backpacking nights in the last two years
- Experience with rain, cold, heat, navigation, water treatment, food storage, first aid, and solo travel
- Current gear and approximate carried weight

### Step 4 — Life capacity

- Available hours by weekday and weekend
- Maximum training time in a normal week
- Recurring blocked dates and caregiving commitments
- Work leave options and longest plausible absence
- Training locations and travel time
- Budget range, savings capacity, and major purchasing constraints
- People affected by the plan

### Step 5 — Risk preferences

- Solo, partner, group, or undecided
- Comfort with weather, wildlife, remoteness, hitching/shuttles, shelters, and tenting
- Satellite communicator preference
- Bailout and communication expectations

### Step 6 — Baseline result

Produce:

- a short narrative snapshot
- knowns, unknowns, constraints, and assumptions
- nine readiness-lane stages with confidence
- the first 14-day plan
- 2–3 plausible completion strategies
- no launch date unless sufficient evidence exists

---

## 5. Strategy decision: a reversible branch

Create a decision object named **Completion strategy** with these options:

### A. Traditional thru-hike

Best when the user can safely sustain a multi-month hike and secure roughly six months away. The ATC says the average thru-hike takes around six months; the official 2026 Trail length is 2,197.9 miles. Treat mileage as annual reference data, not a hard-coded eternal constant.

### B. Section completion

Complete the entire Trail over more than 12 months through staged sections. Optimize around available leave, seasons, travel costs, and continuity tracking.

### C. Flip-flop or alternative thru-hike

Use multiple termini or directions to fit season, crowding, weather, and logistics.

### D. Undecided / preserve options

Continue shared preparation while collecting evidence. Do not force the decision early.

Each strategy card should show:

- time-away requirement
- likely calendar span
- major advantages and tradeoffs
- decisions unlocked by selecting it
- what remains reversible
- next date or evidence point for revisiting the choice

---

## 6. Seed roadmap

Phases are gate-based. A user can work in multiple readiness lanes, but may not bypass a critical gate merely because a target month arrived.

### Phase 0 — Orient and establish safety boundaries

**Purpose:** understand the goal, current reality, and what requires professional input.

Milestones:

1. Write the personal definition of success and reasons for doing this.
2. Complete the health, activity, experience, schedule, and money baseline.
3. Record known limitations, uncertainties, and red flags.
4. If indicated, review intended activity with a qualified clinician and record agreed boundaries—not private medical records.
5. Identify emergency contact and one planning ally.
6. Create a “not yet known” research queue.

**Exit gate:** baseline is complete enough to choose safe foundation activities; unresolved health concerns have an explicit next step.

### Phase 1 — Explore the undertaking

**Purpose:** understand what completion actually demands before buying or booking.

Milestones:

1. Compare thru-hike, section, and flip-flop strategies.
2. Learn the Trail's major regions, terrain progression, seasons, access constraints, and common hazards.
3. Study representative hiker experiences without treating anecdotes as rules.
4. Review Leave No Trace, food storage, water treatment, weather, wildlife, and emergency basics.
5. Take an easy local hike and record enjoyment, symptoms, recovery, footwear, and surprises.
6. Draft an assumptions register: duration, pace, cost, direction, time away, support, and risk.
7. Hold a first household/work impact conversation.

**Exit gate:** user understands the major strategy choices and wants to proceed to structured preparation.

### Phase 2 — Build the sustainable foundation

**Purpose:** create consistent movement and project habits without chasing peak fitness.

Milestones:

1. Establish a repeatable weekly walking/hiking pattern within safe boundaries.
2. Establish an appropriate strength and mobility routine.
3. Identify nearby routes by distance, elevation, surface, and travel time.
4. Track load, symptoms, sleep, and recovery with a simple weekly check-in.
5. Complete four consistent weeks; interruptions do not reset the count, but the evidence window should remain visible.
6. Create a training fallback menu for bad weather, travel, and low-energy weeks.
7. Begin a dedicated savings plan with ranges rather than false precision.

**Exit gate:** sustainable consistency is demonstrated and recovery is acceptable under the user's agreed safety boundaries.

### Phase 3 — Learn core backpacking systems

**Purpose:** build knowledge before optimizing equipment.

Milestones:

1. Learn shelter, sleep, pack, clothing, water, food, navigation, hygiene, first aid, repair, and communication systems.
2. Build a gear inventory with owned, borrow, rent, test, buy, replace, and retire states.
3. Create a base-weight estimate and distinguish comfort choices from safety essentials.
4. Practice pack fitting and loading.
5. Practice water treatment using the chosen primary method and a backup.
6. Practice compliant food storage for expected regions.
7. Complete a relevant first-aid learning step; record course/skill currency where applicable.
8. Create packing lists for day hike, overnight, shoulder season, and cold/wet conditions.

**Exit gate:** a complete provisional system exists and the user can explain how each critical system works and fails.

### Phase 4 — Validate with progressive field tests

**Purpose:** replace assumptions with real evidence.

Milestones:

1. Complete a fully loaded day hike.
2. Complete back-to-back hiking days.
3. Complete a one-night shakedown with an easy bailout.
4. Complete a two- or three-night trip.
5. Intentionally test a realistic non-dangerous adverse condition such as sustained rain or cool weather.
6. Practice camp setup, water, food storage, navigation, repair, and communication.
7. Log post-trip findings under keep/change/remove/add/learn.
8. Resolve high-severity gear or skill failures before increasing exposure.

**Exit gate:** the system works on a multi-night trip, recovery is acceptable, and no unresolved critical failure remains.

### Phase 5 — Develop hiking durability

**Purpose:** safely increase specificity and learn the user's sustainable pace.

Milestones:

1. Gradually increase time on feet, elevation, terrain difficulty, and pack load—never all at once by default.
2. Complete recurring back-to-back hiking weekends.
3. Test fueling, hydration, blister prevention, foot care, and recovery routines.
4. Identify early warning signs and personal stop/modify rules.
5. Complete a representative long weekend on rugged terrain.
6. Establish a sustainable pace range rather than a single target mileage.
7. Run a recovery week and confirm the plan supports rest.

**Exit gate:** repeated representative weekends are tolerated within agreed health boundaries, with stable recovery and working routines.

### Phase 6 — Prove the plan with an extended shakedown

**Purpose:** simulate the operational reality before committing to a launch.

Milestones:

1. Plan and complete a 5–10 day shakedown appropriate to the chosen strategy.
2. Perform at least one resupply.
3. Test communications and an unplanned-but-safe itinerary adjustment.
4. Track daily distance, elevation, carried weight, conditions, symptoms, mood, sleep, spending, and recovery.
5. Conduct a structured retrospective within 72 hours.
6. Update gear, pace, budget, risk, and strategy assumptions.
7. Decide: advance, repeat with changes, pause, or choose a section-based path.

**Exit gate:** explicit go/repeat/pivot decision supported by field evidence.

### Phase 7 — Lock the completion strategy

**Purpose:** turn demonstrated readiness into a feasible life plan.

Milestones:

1. Select thru, flip-flop, or section strategy and direction.
2. Establish a start window using readiness forecast, seasonal constraints, crowding, access, and personal schedule.
3. Confirm work leave, income, insurance, home, caregiving, mail, bills, pets, vehicle, and relationship plans.
4. Build low/expected/high budgets with contingency reserve.
5. Define resupply philosophy and key logistics without overplanning every town.
6. Define off-trail support roles and communication cadence.
7. Create withdrawal, evacuation, and return-home contingencies.

**Exit gate:** strategy is feasible across readiness, time, money, and household/work commitments.

### Phase 8 — Final preparation and launch readiness

**Purpose:** close critical gaps and verify current external requirements.

Milestones:

1. Recheck official Trail alerts, closures, detours, current mileage, permits, fees, and local rules.
2. Register the hike with ATCamp if appropriate and subscribe to alerts.
3. Obtain applicable permits; do not imply ATCamp registration replaces them.
4. Confirm transportation to start and contingency transportation.
5. Finalize gear only after the last shakedown changes.
6. Confirm medications, care plan, insurance information, emergency contacts, and personal documents as applicable.
7. Back up plans and provide the support person with an emergency information sheet.
8. Complete final readiness review across all nine lanes.
9. Record go / delay / pivot decision and rationale.

**Launch gate:** every critical lane is stage 4, current requirements have been reverified, and the user has made an informed go decision. A delay is a valid outcome.

### Phase 9 — On-trail adaptation

**Purpose:** keep the system useful after launch without becoming a distraction.

Milestones and recurring routines:

1. Low-friction daily log: location, distance, condition, symptoms, sleep, mood, and notes.
2. Weekly review: pace range, recovery, spending, gear, weather, and upcoming constraints.
3. Record zero days, route changes, injuries, and strategy changes neutrally.
4. Surface current official alerts and items due for reverification.
5. Trigger a decision review after specified warning patterns or a major incident.

### Phase 10 — Completion, recovery, and integration

1. Confirm completed sections and unresolved gaps.
2. Plan immediate recovery and return-home logistics.
3. Archive gear and financial lessons.
4. Capture story, photos, gratitude, and acknowledgements.
5. Apply for ATC 2,000-miler recognition if eligible and desired.
6. Decide what stewardship, volunteering, or future hiking role comes next.

---

## 7. Gate logic

Represent gates as first-class objects, not checklist labels.

Gate types:

- `information`: a key unknown has been resolved
- `health`: safe boundaries or required professional review recorded
- `consistency`: evidence over a defined time window
- `field_test`: completed real-world test with no unresolved critical finding
- `life`: work/home/financial feasibility confirmed
- `compliance`: rules or permits verified recently enough
- `decision`: explicit human choice with rationale

Gate states:

- not started
- gathering evidence
- ready for review
- passed
- passed with conditions
- blocked
- expired / recheck required
- overridden

Override behavior:

- Critical gates require a typed reason.
- Show who/when, preserve prior state, and keep a warning visible.
- Never label an override as a pass.
- Health gates must never claim medical clearance unless the user explicitly records that a qualified professional provided it.

---

## 8. Adaptive planning engine

Use transparent rules, not opaque AI scoring.

### Inputs

- active strategy
- readiness-lane stages and confidence
- incomplete prerequisites and gates
- user weekly capacity
- blocked dates
- energy/health status selected by the user
- action effort, duration, location, cost, risk, and dependencies
- season-sensitive windows
- evidence recency

### Recommendation rules

1. Exclude actions with unmet hard prerequisites.
2. Prioritize safety blockers and information that unlocks several downstream decisions.
3. Fit actions within the next seven days of available capacity.
4. Maintain no more than four active actions.
5. Prefer the smallest useful field test over more research once foundational knowledge exists.
6. Pair higher-load physical work with recovery; do not stack increases in duration, elevation, terrain, and load by default.
7. If the user reports worsening symptoms or unusual recovery, stop recommending progression and surface the user's stop/modify plan plus appropriate professional review language.
8. Explain every recommendation in plain language: “This comes next because…”
9. Offer a lower-energy alternative that still advances the project.

### Forecast

Display a range such as **“Earliest plausible launch window: Spring 2029 — confidence low.”**

The forecast should include:

- earliest gate-feasible window
- confidence: low, medium, high
- top three assumptions
- top three forecast drivers
- change since last review and why

Do not calculate a launch window until enough baseline fields exist. Never show an exact day more than 12 months out unless it is an externally fixed booking or user-entered commitment.

---

## 9. Information architecture

### Sidebar

**Command**

- Today
- Journey
- Readiness
- Decisions
- Risks & assumptions

**Prepare**

- Training & recovery
- Skills
- Gear
- Field tests
- Route & logistics
- Budget
- Life plan

**Evidence**

- Activity log
- Trip reports
- Documents
- Research & sources

**Review**

- Weekly review
- Forecast history
- Change log
- Settings / import / export

### Today screen

Above the fold:

- North Star and active strategy
- overall status in words, not a percentage
- forecast window and confidence
- primary next action with reason and definition of done
- supporting actions and low-energy win
- capacity used this week
- blockers needing attention

Below:

- nine-lane readiness strip
- upcoming gates
- recent evidence
- “what changed” summary

### Journey screen

- Horizontal phase map for orientation
- Phase cards with purpose, entry conditions, exit gate, and lane contributions
- Toggle between “whole journey” and “next 90 days”
- No arbitrary `1 of 50 = 2%` completion score

### Readiness screen

- Nine rows, stages 0–4
- Evidence, confidence, blockers, next test, and recency per row
- Clearly distinguish “learned,” “practiced,” and “demonstrated outdoors”

### Decisions screen

Decision journal with:

- question
- options and tradeoffs
- decision deadline or trigger
- evidence needed
- current choice
- reversibility
- rationale
- review date

### Weekly review

Ask:

1. What did you complete?
2. What evidence did you learn from?
3. How did your body and recovery respond?
4. What changed in available time, money, or support?
5. What needs to stop, start, continue, or be simplified?
6. Keep the current forecast, or re-plan?

Generate the next rolling plan only after showing proposed changes.

---

## 10. Data model

Use TypeScript types and a versioned persistence schema.

```ts
type Strategy = "undecided" | "thru-nobo" | "thru-sobo" | "flip-flop" | "section";
type LaneKey =
  | "health"
  | "fitness"
  | "durability"
  | "skills"
  | "gear"
  | "field-validation"
  | "finance"
  | "life"
  | "route-logistics";

interface Goal {
  id: string;
  title: string;
  why: string;
  successDefinition: string;
  activeStrategy: Strategy;
  earliestAllowedStart?: string;
  desiredWindow?: { start: string; end: string };
  maxTimeAwayDays?: number;
  nonNegotiables: string[];
  createdAt: string;
  updatedAt: string;
}

interface ReadinessLane {
  key: LaneKey;
  stage: 0 | 1 | 2 | 3 | 4;
  confidence: "low" | "medium" | "high";
  evidenceIds: string[];
  blockerIds: string[];
  nextTest?: string;
  assessedAt: string;
}

interface Phase {
  id: string;
  order: number;
  title: string;
  purpose: string;
  status: "locked" | "available" | "active" | "completed" | "paused";
  entryGateIds: string[];
  exitGateIds: string[];
}

interface Milestone {
  id: string;
  phaseId: string;
  laneKeys: LaneKey[];
  title: string;
  outcome: string;
  status: "not-started" | "active" | "blocked" | "ready-review" | "complete" | "skipped";
  definitionOfDone: string[];
  prerequisiteIds: string[];
  evidenceIds: string[];
  targetWindow?: { start: string; end: string };
  riskLevel: "low" | "medium" | "high" | "critical";
}

interface Action {
  id: string;
  milestoneId?: string;
  title: string;
  reason: string;
  status: "backlog" | "next" | "doing" | "done" | "deferred";
  estimatedMinutes: number;
  energy: "low" | "medium" | "high";
  costEstimate?: number;
  dueAt?: string;
  prerequisiteIds: string[];
  completedAt?: string;
}

interface Gate {
  id: string;
  type: "information" | "health" | "consistency" | "field_test" | "life" | "compliance" | "decision";
  title: string;
  critical: boolean;
  state: "not-started" | "gathering" | "ready-review" | "passed" | "conditional" | "blocked" | "expired" | "overridden";
  criteria: string[];
  evidenceIds: string[];
  conditions?: string[];
  verifiedAt?: string;
  expiresAt?: string;
  overrideReason?: string;
}

interface Evidence {
  id: string;
  type: "activity" | "trip-report" | "document" | "note" | "receipt" | "course" | "conversation" | "external-source";
  title: string;
  occurredAt: string;
  summary?: string;
  attachmentName?: string;
  relatedIds: string[];
}

interface SourceRecord {
  id: string;
  title: string;
  url: string;
  publisher: string;
  topic: "trail-facts" | "permit" | "closure" | "safety" | "transport" | "other";
  verifiedAt: string;
  recheckBy: string;
  notes?: string;
}

interface WeeklyCheckIn {
  id: string;
  weekOf: string;
  plannedMinutes: number;
  completedMinutes: number;
  recovery: 1 | 2 | 3 | 4 | 5;
  symptomsChanged: boolean;
  notes?: string;
  proposedPlanChanges: string[];
}

interface ForecastSnapshot {
  id: string;
  createdAt: string;
  earliestWindow?: { start: string; end: string };
  confidence: "insufficient-data" | "low" | "medium" | "high";
  assumptions: string[];
  drivers: string[];
  changeExplanation: string;
}
```

Also model budgets, gear items, trips, training sessions, route sections, risks, contacts, blocked dates, and strategy history. Every entity must have stable IDs, timestamps, and migration support.

---

## 11. Technical direction

### Recommended v1 stack

- Next.js with TypeScript
- Tailwind CSS and accessible headless components
- IndexedDB for local-first persistence
- Zod for schema validation and import validation
- Recharts only where a chart answers a real question
- Optional installable PWA behavior
- No account required in v1

If an existing project already has an established stack, preserve it unless incompatible with these requirements.

### Persistence

- Autosave every edit.
- Show “Saved locally” plus last saved time.
- Export and import a human-readable, versioned JSON archive.
- Import must preview changes, validate schema, and never overwrite current data without confirmation.
- Include a seeded demo profile and a clean-start mode.
- Provide backup reminder settings.

### Accessibility and privacy

- Meet WCAG 2.1 AA for keyboard use, focus, labels, contrast, reduced motion, and status not conveyed by color alone.
- Health notes remain local in v1 and are excluded from telemetry.
- Provide delete/export controls.
- Avoid shame language, streak pressure, red failure states, and competitive scoring.

### Responsive behavior

- Desktop: persistent sidebar and multi-column Today view.
- Tablet: collapsible sidebar.
- Mobile: bottom navigation for Today, Journey, Log, Review, More.
- On-trail logging must work one-handed and offline.

---

## 12. Visual direction

The reference screenshot has useful clarity but too much empty administrative chrome and an overly linear milestone model. Keep its calmness and strong “current action” focus, then improve it.

Design language:

- warm off-white background, deep forest green, slate text, restrained sky-blue interaction color, amber for attention
- topographic-line texture used sparingly
- crisp typography and generous but not wasteful spacing
- status language such as “On track,” “Needs evidence,” “Waiting,” and “Recheck due”
- small visual blazes as phase markers, not decorative gamification
- celebration should be quiet and meaningful: field evidence and preparedness, not confetti for checking boxes

Primary overview hierarchy:

1. North Star
2. current focus
3. safety or decision blockers
4. readiness lanes
5. forecast and explanation
6. recent evidence and upcoming review

---

## 13. Seed content requirements

The application must ship with:

- all roadmap phases and milestones above
- onboarding prompts above
- decision templates for completion strategy, direction, solo/partner, shelter preference, gear changes, and launch go/no-go
- trip report template
- weekly review template
- risk register template
- budget categories
- gear system categories
- official source records listed below
- representative demo data that makes every major screen understandable

Do not pre-fill the user's health state, fitness level, launch date, budget, or route choice.

---

## 14. Acceptance criteria for v1

### Onboarding

- A new user can stop and resume onboarding.
- “I don't know yet” never blocks basic setup.
- Completing onboarding creates a baseline, first 14-day plan, and strategy options.
- Material health uncertainty produces a professional-review gate without blocking safe research tasks.

### Daily use

- Today displays exactly one primary action and no more than three supporting actions.
- Every recommendation has a visible reason and definition of done.
- The user can defer an action and record why.
- The app does not increase workload merely because tasks were completed early.

### Gates and evidence

- Critical milestones cannot complete until required gates pass or are explicitly overridden.
- Overrides preserve the original state and reason.
- Evidence can attach to multiple milestones, gates, and lanes.
- Expired external information is visibly marked for recheck.

### Forecasting

- Insufficient baseline data produces “Not enough information yet,” not a fabricated date.
- Every forecast has confidence, assumptions, and drivers.
- A forecast change is recorded in history with an explanation.
- Switching strategy preserves history and recalculates relevant milestones.

### Local data

- Reloading the browser preserves state.
- Export produces versioned JSON.
- Import validates and previews before replacing or merging.
- A failed import leaves existing data unchanged.

### Accessibility

- All core flows work by keyboard.
- Form errors are announced and linked to fields.
- Color is never the only status signal.
- Reduced-motion preference is respected.

---

## 15. Build sequence for Cursor

Implement in vertical slices. Keep the app runnable after each slice.

1. **Foundation:** app shell, design tokens, routing, local persistence, seeded demo, export/import.
2. **Goal and onboarding:** wizard, baseline, strategy options, first-plan generation.
3. **Today:** primary/supporting actions, capacity, blocker strip, action completion/defer flows.
4. **Journey and readiness:** phase map, lanes, evidence, gates, milestone details.
5. **Reviews and adaptation:** weekly check-in, recommendation rules, forecast snapshots, strategy switching.
6. **Domain workspaces:** training, skills, gear, trips, money, life plan, route sources.
7. **Offline/mobile polish:** fast logging, PWA, keyboard and screen-reader QA, backup reminders.

After each slice:

- run type checks, lint, and tests
- test empty, demo, partially complete, paused, and overridden-gate states
- verify data survives reload and schema migration
- update a short implementation status document with decisions and remaining work

Do not begin with a backend, authentication, AI chat, or third-party integrations. Prove the personal planning loop first.

---

## 16. Current official source seeds

Store these as editable `SourceRecord` entries and mark them for periodic reverification:

1. Appalachian Trail Conservancy, **A.T. Basics**  
   https://appalachiantrail.org/experience/hike-the-trail/at-basics/

2. Appalachian Trail Conservancy, **Register Your Hike / ATCamp**  
   https://appalachiantrail.org/experience/hike-the-trail/at-basics/register-your-hike/

3. National Park Service, **Appalachian National Scenic Trail — Plan Your Visit**  
   https://www.nps.gov/appa/planyourvisit/

4. National Park Service, **Fees and permits**  
   https://www.nps.gov/appa/planyourvisit/fees.htm

5. Appalachian Trail Conservancy, **Trail updates**  
   https://appalachiantrail.org/trail-updates/

6. Appalachian Trail Conservancy, **2,000-Miler application**  
   https://appalachiantrail.org/experience/hike-the-trail/thru-hiking/2000-milers/2000-miler-application/

Important product copy:

- The official 2026 A.T. length is **2,197.9 miles**, and official mileage can change annually.
- A hike of the entire Trail within 12 months or less is recognized as a thru-hike; completion in sections over more than 12 months is also recognized.
- ATCamp is a voluntary registration and crowd-management tool; it is not a permit or shelter reservation.
- There is no single Trail-wide permit. Requirements and fees vary by land unit and can change.
- Official closures, detours, permit terms, and fees must be rechecked near departure.

---

## 17. Cursor kickoff instruction

Use the full brief above as the product source of truth. First inspect the current repository and summarize the existing stack and reusable components. Then create:

1. a concise implementation plan mapped to the seven build slices;
2. the proposed route map and component tree;
3. the versioned TypeScript domain schema;
4. a list of assumptions or conflicts that truly block implementation.

Proceed with slice 1 immediately if no blocking conflict exists. Make reasonable, reversible product decisions without asking about minor styling details. Preserve existing working code and keep unrelated changes untouched.

