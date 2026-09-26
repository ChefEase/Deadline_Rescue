# Deadline Rescue: Product and Developer Context

| Document detail | Value |
| --- | --- |
| Version | 1.0 |
| Date | September 26, 2026 |
| Goal | Working hackathon prototype in about 16 hours |
| Platform | Responsive web app for phones and laptops |
| Status | Proposed implementation specification; features are not yet built |

## 1. Product overview

Deadline Rescue helps students turn assignments and available time into a realistic study plan. Users enter or paste assignments, confirm deadlines, estimate the work remaining, and set their availability. The app schedules study sessions, recommends one next action, and rebuilds the plan when circumstances change.

**Product promise:** Know what to work on now, see what fits before each deadline, and recover when plans change.

The primary audience is students balancing assignments with classes, jobs, and personal commitments. The hackathon prototype supports one person in one browser.

### Core experience

1. Capture assignments and confirm their details.
2. Define available study hours and unavailable commitments.
3. Build a realistic schedule.
4. Start one study session in a focused workspace.
5. Record progress and remaining effort.
6. Replan when work or availability changes.

Scheduling time does not guarantee completion. Every feasibility statement depends on the user's estimates and entered availability.

### Product decisions and implementation defaults

The agreed direction is student productivity, source-backed deadline extraction, deterministic scheduling, clear conflict explanations, browser-local storage, no required account, Todoist-inspired task management, and Vercel deployment. A dedicated Focus screen and session review provide the requested one-task-at-a-time experience.

Route names, field limits, scheduling intervals, and visual tokens are practical defaults. Adjust them if testing reveals a usability problem.

## 2. Scope and priorities

### P0: required prototype

- First-open welcome with a sample-data option.
- Manual assignment entry and editing.
- Paste-text extraction through one AI endpoint, followed by user confirmation.
- Weekly study windows and one-off commitments.
- A deterministic scheduler with partial allocation and shortfall reporting.
- My Plan with a Next Up card, agenda, and desktop calendar.
- One active Focus session at a time, with pause and end controls.
- Session review that explicitly updates remaining work.
- Replanning and a readable summary of changes.
- Browser-local saving, refresh recovery, and useful empty/error states.
- A publicly usable production link, tested on a phone and laptop.

### P1: only after P0 works

- Calendar event download (.ics).
- Lock a future study block to a chosen time.
- Undo the most recent plan replacement.
- Compact session history.
- More polished movement highlights after replanning.

### Out of scope for this event

- Native iOS/Android binaries or app-store releases.
- Accounts, cloud synchronization, collaboration, payments, subscriptions.
- University portal access, email access, Google Calendar synchronization.
- PDF/image uploads, OCR, notifications, recurring assignment rules.
- Website blocking, operating-system focus controls, Pomodoro systems, streaks.
- Chatbot interface, automatic assignment solving, automatic submission.
- Optimal scheduling claims or guaranteed grades/productivity.

The complete core flow takes priority over features borrowed from reference apps.

## 3. Page count and information architecture

Build **six pages** and **three permanent navigation destinations**. Forms and reviews open as overlays instead of separate pages.

| ID | Page | Suggested route | Purpose |
| --- | --- | --- | --- |
| P1 | Welcome | `/` | Start a plan or try the example |
| P2 | My Plan | `/plan` | Next action, agenda/calendar, schedule status |
| P3 | Assignments | `/assignments` | Manage all work and remaining effort |
| P4 | Availability | `/availability` | Study windows and fixed commitments |
| P5 | Assignment details | `/assignments/[id]` | Inspect/edit one assignment and its source |
| P6 | Focus | `/focus/[sessionId]` | Work on exactly one assignment session |

Permanent navigation: **Plan · Assignments · Availability**. Put it at the bottom on phones and in a left sidebar on laptops. Detail pages have a Back control. Focus hides permanent navigation but keeps a visible Back to Plan control.

### Reusable overlays and embedded states

| Component | Entry | Exit |
| --- | --- | --- |
| Add assignment | Add button on Plan or Assignments | Saved detail or return to invoking page |
| Extraction review | Successful text extraction | Confirm assignments or return to pasted text |
| Edit commitment | Availability or calendar commitment | Save or cancel |
| Session review | End Focus session or reach planned duration | Save progress and return to Plan |
| Plan changes | Replan succeeds | Dismiss and inspect updated plan |
| Confirmation dialog | Delete, reset, discard unsaved work | Confirm or cancel |
| Preferences | Small control on Availability | Save timezone/session settings |

Use a full-height panel for long forms on phones and a dialog or side panel on laptops. Both layouts must have the same fields and validation. Browser Back must warn before discarding unsaved form data.

## 4. Complete user journeys

### 4.1 First visit: create a personal plan

1. Load saved browser data before choosing a page. Show a brief loading state to avoid flashing Welcome before a redirect.
2. With no saved state, open Welcome.
3. User selects **Create my plan** and lands on Assignments with a small setup checklist.
4. They add at least one assignment manually or paste instructions.
5. If they pasted instructions, keep extracted details as drafts. The user confirms each deadline and enters remaining effort.
6. Setup checklist offers **Set my availability**.
7. Availability shows proposed study windows and the detected timezone. The user reviews and saves them before building a plan.
8. User optionally adds class/work commitments.
9. **Build my plan** validates the inputs and generates sessions.
10. Navigate to My Plan. Show the next session and a schedule summary, including any work that did not fit.
11. User selects **Start focus** for the current session.
12. They end the session, record remaining effort, and return to an updated Plan.

The checklist guides setup without locking navigation. Users can switch between Assignments and Availability. Building a plan requires at least one valid active assignment and confirmed availability.

### 4.2 First visit: judge/sample experience

1. Welcome offers **Try an example** next to the personal-plan option.
2. Load synthetic assignments and commitments, then generate a schedule.
3. Open My Plan with a persistent **Example data** label.
4. User adds an unexpected commitment through Availability.
5. Saving marks the schedule as needing an update; user selects Replan.
6. The app explains which sessions moved and which assignments now have a shortfall.
7. User can start a Focus session, edit effort, or reset the example.
8. **Start my own plan** confirms before deleting the sample data and opens empty Assignments.

If a personal plan exists, confirm before replacing it with sample data and explain what will be lost. Generate sample dates relative to the user's local date so the example stays useful.

### 4.3 Returning visit

- Saved data with no active session: open My Plan, restoring the selected date if still within the planning horizon.
- A persisted active or paused session: open Focus with a Resume/Review choice. Do not invent completed work during an absence.
- A missed or expired planned session: ask how much the user actually worked before recording progress.
- Incomplete setup: open the last relevant setup destination with a checklist of missing information.
- Unreadable or unsupported stored data: show a recovery message and offer a deliberate reset. Do not silently destroy it.

### 4.4 A disruption occurs

1. User adds a work shift or changes a deadline/remaining effort.
2. Save the changed input immediately.
3. Mark the existing plan **Needs update**; show the reason.
4. Disable starting obsolete scheduled sessions until recalculation. An already-running focus session may continue.
5. On Replan, build and validate the replacement schedule before saving it.
6. Show moved, added, removed, and unscheduled work in plain language.
7. Return the user's attention to the next feasible action.

In P0, the user starts replanning after changing an input. Do not rearrange the calendar while they type.

## 5. Screen specifications

### P1. Welcome

Purpose: explain the app and let users begin immediately.

Content:

- Deadline Rescue name and simple icon.
- Headline: **One task at a time. A plan that fits.**
- Supporting sentence: “Add your assignments and available time. Get a study plan that adjusts when life changes.”
- Primary action: Create my plan.
- Secondary action: Try an example.
- Small disclosure: “Saved in this browser. No account needed.”

Keep both actions visible without scrolling on a typical phone. Skip carousels, signup, and long tutorials.

### P2. My Plan

Purpose: answer **What should I work on now?** and **Does everything fit?**

Information order on phones:

1. Page title and selected date.
2. Schedule status banner.
3. **Next Up** card for one assignment session.
4. Daily agenda with commitments and study blocks.
5. Replan action when relevant and an Add assignment shortcut.

The Next Up card shows the assignment title and course, session start and end, planned duration, actual deadline, and Start focus or View assignment action.

Selection rules:

- If a focus session is active, show Resume focus.
- Otherwise, select the earliest unfinished study session that is current or upcoming.
- Show future sessions as “Next at 7:00 p.m.”; do not imply work should start during a blocked period.
- Missed sessions are not marked complete. Mark the plan stale and offer Replan.
- When work is unscheduled, show its shortfall even if other work has a valid Next Up session.
- With no active assignments, show “You're all caught up” and an Add assignment action.

In P0, users can start Focus during the current scheduled block. To start earlier, they can change availability and replan. An early-start override is outside scope.

Plan status values:

| Status | Meaning | Action |
| --- | --- | --- |
| Setup needed | Missing valid assignments or confirmed availability | Complete setup |
| Needs update | Inputs changed or sessions were missed | Replan |
| All work fits | Every active assignment's remaining minutes are allocated before its deadline | Start next session |
| Work needs attention | One or more assignments have unallocated minutes | Review shortfalls |
| No work remaining | No active assignments | Add assignment |

A conflict card shows the assignment, deadline, remaining work, scheduled work, and shortfall. Say “couldn't be scheduled with this plan”; the app cannot prove that no possible schedule exists.

On desktop, use a sidebar, a task and Next Up panel, and a wider weekly calendar. Users can select calendar events to inspect them. Click or tap editing is sufficient; dragging is optional.

### P3. Assignments

Purpose: capture and manage work outside the Focus screen.

- Page title and Add assignment button.
- Active and Completed filters.
- Active assignments sorted by deadline, then creation time.
- Each item shows its title, course, due date and time, remaining effort, and scheduling status in text.
- Tap/click opens Assignment details.
- Empty state explains manual entry and pasting instructions.

Add assignment panel contains two modes: **Enter manually** and **Paste instructions**.

Manual fields:

| Field | Requirement | Validation |
| --- | --- | --- |
| Title | Required | 1–120 characters after trimming |
| Course | Optional | Up to 60 characters |
| Due date and time | Required | Explicit valid local date/time in plan timezone |
| Remaining work | Required | Positive whole minutes entered through hours/minutes controls |
| Notes | Optional | Up to 2,000 characters |

Allow overdue assignments, but explain that they cannot receive new sessions before a deadline that has passed. The user must change the date or handle the overdue work. Never change a deadline automatically.

Paste instructions flow:

1. User pastes up to 12,000 characters.
2. Explain that this text is sent to an AI provider for extraction.
3. Extract returns at most 10 draft assignments for the prototype.
   If the input appears to contain more, show a limit warning and ask the user to split it into smaller submissions; do not imply the extraction is complete.
4. Review cards show title, proposed course, deadline text, original quote, and uncertainty messages.
5. User corrects fields, sets remaining effort, and deselects irrelevant draft assignments.
6. Confirm selected assignments validates and saves only the confirmed items.

Leave missing deadlines blank. For a date without a time, require the user to choose a time; 11:59 p.m. may be offered as an explicit suggestion. Require confirmation for relative or ambiguous dates. A source quote must match the pasted text exactly; otherwise, remove it and mark the extraction unverified.

If a draft matches an existing assignment by title and deadline, warn the user and let them skip it. Repeating an extraction must not silently create duplicates.

### P4. Availability

Purpose: define when study sessions may be scheduled.

Sections:

- Plan timezone, initially detected and editable.
- Study windows per weekday, using start/end controls and an enabled toggle.
- Upcoming one-off commitments.
- Default session length, initially 30 minutes.
- Save availability and Replan actions.
- Small browser-data reset action with confirmation.

Propose weekdays 4–10 p.m. and weekends 10 a.m.–6 p.m. as editable starting points. Require the user to review them before building a plan. Time outside enabled windows is unavailable; sleep needs no separate setting.

Each commitment has a title, local date, start time, end time, and optional class/work/personal category. End must be after start. In P0, a commitment spanning midnight uses two entries. Merge overlapping commitments during scheduling so time is subtracted only once.

When the user changes timezone, explain that existing deadlines and commitments keep their actual instants but display in the new zone. Weekly study windows keep their local clock times. Rebuild the plan afterward.

### P5. Assignment details

Show title, course, confirmed deadline, remaining effort, notes, original source quote when available, scheduled sessions, and current shortfall.

Actions:

- Edit details.
- Update remaining effort.
- Mark assignment complete.
- Reopen completed assignment, requiring positive remaining effort.
- Delete assignment with confirmation.
- Back to invoking page; direct links fall back to Assignments.

Completing or deleting an assignment removes its future unstarted sessions. Completing it preserves completed-session history; deleting it removes that history after a warning. If its Focus session is active, require session review before completion or deletion.

Changing a deadline or effort estimate marks the plan as needing an update. Keep the original source quote after an edit, and label the deadline “Edited by you” when it differs from the extracted value.

### P6. Focus

Purpose: keep attention on one assignment session.

Display:

- One assignment title and course.
- The current session's planned duration and deadline.
- A simple elapsed-time display.
- Optional instruction/notes expansion, collapsed by default.
- Pause/Resume and End session actions.
- Back to Plan control.

Do not display unrelated assignments, a full calendar, streaks, a chatbot, or promotional content here. The app guides attention; it does not block other websites or apps.

Only one session may be active or paused. Before starting another, ask the user to resume or end the existing one. Back to Plan preserves a paused session and shows Resume focus on Plan.

At the planned end, show “Time to review your progress.” Do not mark the assignment complete. Calculate elapsed time from saved timestamps because background tabs can delay timer updates. After a hidden tab or refresh, ask the user to confirm actual worked time before saving a long or expired session.

Session review asks:

1. How long did you actually work? (Editable suggestion.)
2. Is this assignment finished? (Yes/No.)
3. If No: how much work remains? (Required positive duration.)

The remaining-time field may suggest the prior estimate minus confirmed work time, with a minimum of zero. The user must confirm or correct it. If they enter zero, ask whether the assignment is complete. Elapsed time alone does not prove progress.

Save each review once: record the work log, update the assignment, close the session, and replan future work. Double clicks and refreshes must not apply progress twice. Return to Plan with a brief confirmation and the next recommended action.

## 6. Scheduling specification

### Time model and horizon

- Use one explicit IANA timezone per plan.
- Store dated deadlines, commitments, and session boundaries as UTC instants; display them in the plan timezone.
- Represent recurring study windows as local weekday and local start/end time.
- Planning horizon: now through 14 local calendar days. Show this limit in the interface.
- Schedule active assignments due within the horizon. Label later assignments “Outside current planning window” and exclude them from the “All work fits” claim.
- Use half-open intervals `[start, end)` so adjacent events do not overlap.
- Use a 15-minute scheduling grid. Round availability starts forward and ends backward so rounding never creates extra time.
- Require a final scheduling deadline boundary at or before the exact confirmed deadline.
- Convert each recurring local window into dated intervals with a timezone-aware library. Skip nonexistent local times and choose a consistent offset for ambiguous times. Do not advance dates by adding 24 hours across daylight-saving changes.

### Inputs

The scheduler takes confirmed active assignments, remaining work, deadlines, approved study windows, dated commitments, the current time, the planning horizon, and any active Focus interval.

### P0 algorithm

1. Expand study windows into dated intervals within the horizon.
2. Clip intervals to now and the horizon, then subtract the union of commitments.
3. Reserve an active Focus interval, if any. Replanning must not move work in progress. If a new commitment overlaps it, show the conflict and let the user end Focus or edit the commitment. Count reserved minutes toward that assignment's planned allocation so they are not scheduled twice. Do not reduce the stored effort estimate until the user saves a session review. At review, release unused reserved time and replan from the confirmed estimate.
4. Exclude completed assignments. Flag overdue assignments separately.
5. Sort eligible assignments by earliest deadline, then creation timestamp, then ID for deterministic ties.
6. Round remaining work up to the nearest 15 minutes for scheduling only. Keep the user's estimate unchanged and show when rounding adds scheduled time.
7. Walk available slots in chronological order before each assignment's deadline.
8. Group adjacent slots into sessions, normally 30 minutes each. Allow a final 15-minute session.
9. Record allocated and unallocated minutes per assignment. Keep any feasible partial schedule.
10. Validate no overlaps, no blocked-time allocation, no scheduling before now, and no newly allocated session ending after its deadline.
11. Save the validated future plan in one operation. Keep completed-session history.

P0 does not insert breaks. Users may block them in Availability; the app must not claim to have allowed for breaks that were not entered.

This deterministic greedy algorithm is explainable but does not guarantee an optimal schedule. Revisit it if future versions add more constraints.

### Replanning differences

Compare old and new future sessions by assignment and time. Summarize additions, removals, moves, and changed shortfalls without listing every 15-minute slot.

Example: “Programming: 60 minutes moved from Tuesday to Monday. Maths: 30 minutes could not be scheduled.”

Never alter deadlines, effort estimates, or availability to make a schedule appear successful. Offer possible remedies for the user to choose. Only the user can enter a changed deadline; the app cannot grant an extension.

## 7. Database schema and persistence

**P0 database:** one versioned JSON document in browser `localStorage`. The prototype has no accounts or server-side database, so adding a hosted database would increase scope without supporting the agreed single-browser experience. The TypeScript types below are the complete persisted schema. An AI extraction response is a temporary draft and enters this document only after user confirmation.

```ts
type Id = string; // Generate with crypto.randomUUID().
type Instant = string; // ISO 8601 UTC, for example 2026-09-28T18:00:00.000Z.
type LocalTime = string; // 24-hour HH:mm in the plan timezone.
type LocalDate = string; // YYYY-MM-DD in the plan timezone.
type Minutes = number; // Non-negative integer unless a field says positive.

interface AppState {
  schemaVersion: 1;
  documentRevision: number; // Increments on every persisted change; detects stale tabs.
  inputRevision: number; // Increments when scheduling inputs change.
  mode: "personal" | "example";
  timezone: string; // Valid IANA timezone, such as America/Halifax.
  availabilityConfirmedAt: Instant | null;
  preferences: Preferences;
  assignments: Assignment[];
  studyWindows: StudyWindow[];
  commitments: Commitment[];
  plan: Plan | null;
  activeFocus: ActiveFocus | null;
  workLogs: WorkLog[];
}

interface Preferences {
  sessionMinutes: Minutes; // Default 30; positive multiple of 15.
}

interface Assignment {
  id: Id;
  title: string; // Trimmed, 1–120 characters.
  course: string; // Up to 60 characters; empty string means unspecified.
  dueAt: Instant;
  remainingMinutes: Minutes;
  status: "active" | "completed";
  notes: string; // Up to 2,000 characters.
  source: AssignmentSource | null; // Null for manual entry.
  createdAt: Instant;
  updatedAt: Instant;
  completedAt: Instant | null;
}

interface AssignmentSource {
  excerpt: string; // Relevant part of the pasted text, not the full submission.
  deadlineQuote: string | null; // Must match the submitted text exactly.
  extractedDeadlineText: string | null;
  extractedDueAt: Instant | null; // Original AI suggestion, before user edits.
  confirmedAt: Instant;
  editedByUser: boolean;
}

interface StudyWindow {
  id: Id;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: Monday = 1.
  localStart: LocalTime;
  localEnd: LocalTime; // Later than localStart; no overnight window in P0.
  enabled: boolean;
}

interface Commitment {
  id: Id;
  title: string;
  startAt: Instant;
  endAt: Instant; // Later than startAt; split overnight events in P0.
  category: "class" | "work" | "personal" | null;
}

interface Plan {
  generatedAt: Instant;
  inputRevision: number; // Must equal AppState.inputRevision to be current.
  horizonEndAt: Instant;
  blocks: StudyBlock[];
  shortfalls: Shortfall[];
  overdueAssignmentIds: Id[];
  outsideHorizonIds: Id[];
}

interface StudyBlock {
  id: Id;
  assignmentId: Id;
  startAt: Instant;
  endAt: Instant;
  state: "scheduled" | "active" | "completed" | "missed";
  // Duration is derived from startAt and endAt; do not store it twice.
}

interface Shortfall {
  assignmentId: Id;
  requestedMinutes: Minutes; // Remaining work rounded up to the 15-minute grid.
  allocatedMinutes: Minutes;
  unscheduledMinutes: Minutes; // requestedMinutes - allocatedMinutes.
  reason: "insufficient_availability";
}

interface ActiveFocus {
  id: Id; // Unique focus/review identifier.
  blockId: Id;
  assignmentId: Id;
  startedAt: Instant;
  lastResumedAt: Instant | null;
  accumulatedSeconds: number; // Whole seconds before the latest resume.
  state: "running" | "paused" | "review";
}

interface WorkLog {
  id: Id;
  focusId: Id; // Unique across workLogs; prevents duplicate reviews.
  assignmentId: Id;
  confirmedWorkedMinutes: Minutes;
  remainingBefore: Minutes;
  remainingAfter: Minutes;
  finishedAssignment: boolean;
  savedAt: Instant;
}
```

**Relationships:** `StudyBlock.assignmentId`, `Shortfall.assignmentId`, `ActiveFocus.assignmentId`, and `WorkLog.assignmentId` reference `Assignment.id`. `ActiveFocus.blockId` references `StudyBlock.id`. Keep completed assignment records while their work logs exist. Deleting an assignment also removes its blocks, shortfall, and work logs after confirmation.

**Indexes in memory:** Map assignments and blocks by ID when loading the document. Sort assignments by deadline and creation time; sort blocks and commitments by start time. A separate database index is unnecessary for P0.

### Data invariants

- Each entity has a stable unique ID. Referenced IDs must exist; `WorkLog.focusId` must be unique.
- Completed assignments have zero remaining minutes and no future study blocks.
- Active assignments have positive remaining minutes.
- `activeFocus` is null or one session. Its block and assignment IDs must agree.
- A focus review produces at most one `WorkLog` per `focusId`.
- `plan.inputRevision === inputRevision` means the plan matches the current scheduling inputs; otherwise show Needs update.
- Changing an assignment, study window, commitment, timezone, or session length increments `inputRevision`. A confirmed effort update does too.
- A running Focus session has `lastResumedAt`; a paused or reviewing session has `lastResumedAt: null` after its elapsed seconds are added to `accumulatedSeconds`.
- Each successful document write increments `documentRevision`.
- `Shortfall.unscheduledMinutes` equals requested minus allocated minutes and is never negative.
- All dated intervals have `endAt > startAt`; a scheduled block must end by its assignment deadline.
- No saving of draft AI output into confirmed assignments without a user action.
- Derived totals are recomputed, not independently mutated in several places.

### Persistence

Store `AppState` under a single key such as `deadline-rescue:v1`. Parse and validate it on load, and migrate explicitly if `schemaVersion` changes. Do not silently replace invalid or newer data. Use one central state store. Save confirmed changes; keep unsaved form drafts in component state or a separate short-lived draft key. Calculate the timer from stored timestamps rather than saving every tick.

Update a session review as one state transition: verify that its `focusId` has no work log, add the log, update assignment effort, close `activeFocus`, and rebuild future blocks before writing the document once. This makes a repeated click or refresh harmless.

If browser storage is unavailable or full, warn the user and continue in memory where possible. Explain that refresh may lose work. Browser-local data does not sync between devices and may disappear in private browsing or after clearing site data.

Detect changes from another tab and require the older tab to reload before editing. Check the active Focus session across tabs as well. A single editing tab is acceptable for the prototype.

## 8. AI boundary and failure handling

Use one server-side extraction endpoint, for example `POST /api/extract-assignments`.

**Request:** pasted text, timezone, and reference local date. **Response:** draft assignments with a title, optional course, original deadline text, optional proposed date and time, exact source quote, and ambiguity flags.

Requirements:

- Validate request length and response structure.
- Treat pasted text as untrusted data, never as instructions to the model or app.
- Use AI only to extract; the scheduler remains ordinary deterministic code.
- Keep secrets server-side and outside committed files.
- Do not return model chain-of-thought or expose provider credentials.
- Do not accept arbitrary URLs or browse external documents in P0.
- Set a request timeout, limit retries, and rate-limit the public endpoint.
- Preserve the user's pasted text on failure.
- Never silently substitute fabricated model output in the live flow.
- Use synthetic examples for demonstrations; clearly label them.

| Failure | User-facing behavior |
| --- | --- |
| Provider unavailable or quota exceeded | Explain extraction is unavailable; offer manual entry |
| Request timeout | Stop loading, preserve text, offer Retry |
| Invalid model structure | Show extraction error; do not save partial unvalidated records |
| Ambiguous date | Ask user to select the date/time |
| Missing quote | Mark unverified and require manual confirmation |
| No assignments detected | Explain and offer manual creation |

Send only the text needed for extraction. Keep the calendar and Focus history out of provider requests, and avoid logging pasted instructions.

## 9. Visual and interaction design

Use Todoist as a reference for clear task lists and quick entry. Give Deadline Rescue its own name, icon, copy, colours, and layout. Mobbin screenshots are references, not product assets.

Suggested style tokens:

| Token | Starting value |
| --- | --- |
| Page background | Warm off-white, e.g. `#F7F7F5` |
| Surface | White |
| Primary text | Charcoal, e.g. `#202124` |
| Primary action | Indigo, e.g. `#4F46E5` |
| Borders | Subtle neutral grey |
| Warning | Amber surface plus dark readable text |
| Failure/shortfall | Red accent plus explicit text/icon |
| Font | One readable sans-serif; system font is sufficient |
| Corners | Approximately 12px on cards; consistent throughout |
| Spacing | 4/8/12/16/24/32px scale |

Check actual text contrast during implementation. Colour alone must never communicate scheduling state. Distinguish fixed commitments from study blocks with labels and styling, not just hue.

### Responsive rules

| Width | Layout |
| --- | --- |
| Under 768px | Single-column agenda, bottom navigation, full-height forms |
| 768–1099px | Compact navigation; agenda with optional detail panel |
| 1100px and wider | Sidebar, task panel, weekly calendar |

Adjust these starting breakpoints if content wraps poorly. Use an agenda on phones instead of seven squeezed calendar columns. Make use of laptop width rather than centring a phone-sized layout.

Use touch targets of about 44px, visible keyboard focus, labelled inputs, keyboard-accessible controls, and focus trapping in dialogs. Let Escape close a dialog only when it will not discard unsaved work. Announce schedule results in a polite live region and respect reduced-motion preferences. Core actions must work without dragging, hovering, or swiping.

Call the action **Replan** on every screen. Prevent duplicate submissions while saving or extracting. Show loading indicators only while work is pending, and provide a recovery action after failures.

## 10. Technical stack and organization

Use **GitHub for the source repository** and **Vercel for deployment**. These are required for the hackathon workflow. The application choices below are the proposed stack; prefer familiar tools unless a new dependency solves a specific problem.

| Layer | Choice |
| --- | --- |
| Web app | Next.js and React |
| Language | TypeScript |
| Styling | Lightweight CSS solution |
| Database and state | Versioned browser `localStorage` document, validated at load, with one client state store |
| Dates and timezones | Timezone-aware date library |
| AI extraction | One provider, called through a server-side Next.js API route |
| Source control | Git and a GitHub repository |
| Hosting | Vercel, connected to the GitHub repository |

Keep AI credentials in local environment files and Vercel environment variables. Do not commit secrets to GitHub. Push changes to GitHub and verify the Vercel deployment after each major milestone.

Recommended folder structure (Next.js App Router):

```text
public/
  icon.svg
src/
  app/
    layout.tsx                    # Root layout and metadata
    page.tsx                      # Welcome
    plan/page.tsx                 # My Plan
    assignments/page.tsx          # Assignment list
    assignments/[id]/page.tsx     # Assignment details
    availability/page.tsx         # Study windows and commitments
    focus/[sessionId]/page.tsx    # Single-session Focus view
    api/extract-assignments/
      route.ts                    # Server-side AI extraction endpoint
    globals.css
  components/
    ui/                           # Buttons, fields, dialogs, loading states
    AppShell.tsx                   # Responsive navigation and page frame
    SetupChecklist.tsx
  features/
    assignments/
      AssignmentForm.tsx
      AssignmentList.tsx
      ExtractionReview.tsx
    availability/
      AvailabilityEditor.tsx
      CommitmentForm.tsx
    planning/
      NextUpCard.tsx
      Agenda.tsx
      WeekCalendar.tsx
      ConflictCard.tsx
      PlanChanges.tsx
    focus/
      FocusView.tsx
      SessionReview.tsx
  lib/
    schema/
      types.ts                    # Persisted interfaces from section 7
      validate.ts                 # Runtime parsing and invariants
      migrations.ts               # Explicit storage version changes
    scheduling/
      scheduler.ts                # Pure deterministic algorithm
      intervals.ts                # Subtraction, merging, overlap checks
      changes.ts                  # Human-readable replan differences
    time/
      timezone.ts                 # Local/UTC conversions, DST handling
    persistence/
      storage.ts                  # Browser-only load/save and tab checks
    extraction/
      server.ts                   # Provider call; server-only secrets
      response.ts                 # Draft response validation
    demo/
      sample-data.ts              # Relative-date example data
      fixture.ts                  # Fixed scheduling fixture
  store/
    app-store.ts                  # State transitions and selectors
tests/
  scheduler.test.ts               # Fixture, overlaps, deadlines, shortfalls
  focus-review.test.ts            # Duplicate review and refresh safety
.env.example                      # Variable names only; no credentials
.gitignore
README.md                         # Local setup, GitHub, Vercel, demo steps
package.json
tsconfig.json
```

Keep route files thin: they load state and compose feature components. Put scheduling and time arithmetic in pure `lib/` modules; keep AI credentials inside server-only extraction code. Only browser-side code may access `localStorage`. UI components read the central state rather than implementing scheduling rules. The calendar displays the plan; it does not own it.

For invalid assignment or session links, show a clear not-found state and Back to Plan. Focus routes must check that the session belongs to the saved plan. Wait for browser state to load before rendering content that depends on it.

## 11. Example fixture and demonstration

Verify the scheduler against this fixed fixture, then create relative dates for the live example.

Fixture:

- Timezone: America/Halifax.
- Current time: Monday, September 28, 2026 at 3:00 p.m.
- Study windows: Monday and Tuesday 4–8 p.m.; other days disabled for this fixture.
- Programming: 4 hours remaining, due Tuesday September 29 at 8:00 p.m.
- Maths: 2 hours remaining, due Wednesday September 30 at 8:00 p.m.
- Existing commitment: Monday 6–8 p.m.

**Expected initial plan:** Programming receives Monday 4–6 p.m. and Tuesday 4–6 p.m.; Maths receives Tuesday 6–8 p.m. These periods may be split into 30-minute sessions. All six hours fit.

**Disruption:** Add a Tuesday 6–8 p.m. work shift. Programming still receives four hours; Maths has a two-hour shortfall. No Maths session may overlap the shift or end after its deadline.

**Recovery:** Enable Wednesday 4–6 p.m. study time. After replanning, Maths fits before its deadline.

For the live example, use upcoming local dates and matching availability so it works on any day. Keep the fixed fixture for repeatable verification.

Suggested three-minute demo:

1. Explain the student problem in one sentence.
2. Load the example and show one clear Next Up task.
3. Add the work shift and demonstrate the shortfall.
4. Add suitable availability and repair the plan.
5. Open Focus to show the one-task-at-a-time experience.
6. Briefly show source-backed deadline confirmation and explain the scheduling algorithm.

During the demo, end a Focus session early and enter the actual time worked. Do not simulate a completed 30-minute session.

## 12. Acceptance criteria

### Core functional checks

- [ ] First-time users can try the example without signing in.
- [ ] Users can add an assignment manually without any AI service.
- [ ] Extracted dates are reviewed before entering the schedule.
- [ ] Missing dates and effort estimates prevent invalid scheduling.
- [ ] Commitments and study windows persist after refresh.
- [ ] Overlapping commitments are subtracted once.
- [ ] The deterministic fixture produces the expected allocation and shortfall.
- [ ] Replanning never silently changes a deadline or effort estimate.
- [ ] Partial schedules stay usable while shortfalls remain visible.
- [ ] Overdue and outside-horizon assignments are clearly distinguished.
- [ ] A user can start, pause, resume, and end one focus session.
- [ ] A second focus session cannot run concurrently.
- [ ] Ending a session does not automatically finish the assignment.
- [ ] Refreshing or double-clicking cannot apply a session review twice.
- [ ] Completing an assignment removes its future blocks.
- [ ] An active session is protected during replanning or explicitly resolved if conflicting.
- [ ] Past uncompleted sessions are marked missed and can be replanned.

### Design and usability checks

- [ ] A first-time tester can identify the next task and start focus without spoken instructions.
- [ ] Deadline, session time, and remaining effort are visually distinct.
- [ ] Conflict messages name the assignment and exact shortfall.
- [ ] Core actions work by keyboard and touch.
- [ ] The app remains usable at approximately 390px and 1440px widths.
- [ ] No page relies on hover or colour alone.
- [ ] Forms preserve user input after API/network failure.
- [ ] Sample data is clearly labelled and cannot silently overwrite personal data.

### Deployment checks

- [ ] Source code is pushed to the GitHub repository, with no committed secrets.
- [ ] Vercel is connected to the GitHub repository and deploys the intended branch.
- [ ] Production URL opens in an incognito browser without a hosting-account login.
- [ ] The same URL works on a laptop and phone over mobile data.
- [ ] Server-side API credentials exist only in hosting environment variables/local secrets.
- [ ] AI errors leave manual entry and existing scheduling usable.
- [ ] Refreshing a nested route works.
- [ ] A short backup demo recording and clear project description are prepared.

## 13. Implementation sequence for a 16-hour window

| Time | Deliverable |
| --- | --- |
| Hours 0–1 | Confirm event rules; create GitHub repository; routes, types, app shell |
| Hours 1–2 | Connect GitHub to Vercel and deploy; manual assignments; persistence |
| Hours 2–4 | Availability editor and deterministic scheduler |
| Hours 4–6 | Plan screen, agenda/calendar, shortfalls and replanning |
| Hours 6–8 | Focus session, session review, refresh recovery |
| Hours 8–10 | AI extraction and confirmation with manual fallback |
| Hours 10–12 | Responsive polish, sample fixture, real-user testing |
| Hours 12–14 | Fix core problems; submission, screenshots, demo rehearsal |
| Hours 14–16 | Buffer for breaks, deployment issues, and submission |

Deploy early and keep updating the same project. Reserve time for final verification. If the schedule slips, cut P1 features, advanced calendar interaction, animation, and optional notes first. Preserve manual entry, scheduling, shortfall explanations, and Focus. If AI extraction is unfinished, disclose that in the submission rather than simulating it.

## 14. Judging alignment and learning record

The supplied judging criteria are technology, design, completion, and learning. The table lists evidence to demonstrate, not promised scores.

| Criterion | Evidence to demonstrate |
| --- | --- |
| Technology | Constraint handling, interval arithmetic, deterministic replanning, validated extraction, robust focus state |
| Design | One obvious next action, intuitive forms, readable responsive layouts, useful recovery states |
| Completion | Fresh inputs produce a working schedule; changes, focus, and persistence work end to end |
| Learning | An honest explanation of new skills, a specific bug/challenge, and the solution |

Keep a short development log covering new skills, attempts, failures, changes, and verification. Disclose AI coding assistance honestly and be ready to explain important code decisions.

Confirm any eligibility-sensitive rules with the organizers, including whether work may begin from home before late check-in. Follow the posted submission deadline, link requirements, and disclosure rules. This document does not establish those event rules.

## 15. Reference links and interpretation

- [Todoist iOS flow on Mobbin](https://mobbin.com/explore/flows/9910ff65-57e3-4946-aad3-d032a01f5d71)
- [Tiimo iOS flow on Mobbin](https://mobbin.com/explore/flows/817f5bfd-1701-4756-bcbc-dcdfc3597723) — secondary planning reference
- [MDN responsive design guide](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design)
- [Vercel deployment guide](https://vercel.com/docs/deployments)
- [Vercel domain guide](https://vercel.com/docs/domains/working-with-domains)
- [Hack Atlantic submission page](https://hack-atlantic-2026.devpost.com/)

The Mobbin flow links were verified during prior research, but their full screenshot libraries were not reviewed. Inspect relevant patterns before implementation. The page layout, page count, behaviour, and scope here are Deadline Rescue design decisions, not descriptions of the reference apps.

## 16. Developer handoff instruction

Build P0 as one responsive web app. Complete this loop first: **capture work → confirm constraints → build a plan → focus on one session → review progress → replan**. Use the acceptance criteria to decide when the prototype is done. Every visible primary action must work. Leave unfinished optional features out of the released app, and avoid unsupported claims or unplanned accounts and integrations.
