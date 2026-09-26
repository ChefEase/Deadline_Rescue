# Deadline Rescue: Step-by-Step Development Plan

**Source of truth:** [Deadline_Rescue_Context.md](Deadline_Rescue_Context.md)  
**Goal:** Build and deploy the P0 prototype in a 16-hour hackathon window.  
**Core loop:** Capture work → confirm constraints → build a plan → focus on one session → review progress → replan.

This is an implementation checklist, not a second product specification. If a detail here conflicts with the context file, follow the context file and update this plan. Check off a step only when its **Done when** condition works in the browser.

## Build rules

- Finish the P0 loop before starting any P1 feature.
- Keep GitHub as the source repository and Vercel as the production host. Deploy early and verify the same production project after major milestones.
- **Current collaboration rule:** Keep assistant-made changes local. The user will handle any GitHub push or Vercel deployment; do not perform those remote actions.
- Use the versioned browser `localStorage` schema in context section 7. P0 does not need accounts or a hosted database.
- Build the six pages and three permanent navigation destinations specified in context section 3.
- Keep scheduling deterministic and separate from React and AI extraction.
- Keep manual assignment entry usable if the AI service fails.
- Do not show an action in the released interface unless it works.

## Time budget and milestones

The windows are targets. Move time between steps as needed, but keep the final two hours for verification and submission.

| Window | Milestone | Working result |
| --- | --- | --- |
| Hours 0–1 | 0–1. Rules, repository, scaffold | App runs locally; GitHub repository exists |
| Hours 1–2 | 2–3. Deployment, data foundation, manual entry | Vercel URL works; one assignment survives refresh |
| Hours 2–4 | 4–5. Availability and scheduler | Fixture produces expected sessions and shortfall |
| Hours 4–6 | 6–7. Plan and replanning | User sees Next Up and can repair a disrupted plan |
| Hours 6–8 | 8. Focus and session review | One session can be completed and safely saved |
| Hours 8–10 | 9. AI extraction | Pasted text becomes reviewed draft assignments |
| Hours 10–12 | 10–11. Sample flow and responsive polish | Demo works on phone and laptop |
| Hours 12–14 | 12. End-to-end fixes and release checks | P0 acceptance checks pass on production |
| Hours 14–16 | 13. Submission and buffer | Links, screenshots, recording, and handoff are ready |

## 0. Confirm event constraints

**Checked September 26, 2026:**

- The [Devpost rules](https://hack-atlantic-2026.devpost.com/rules) say projects must start from scratch during the event. Libraries, frameworks, APIs, and starter templates are allowed. Participants must register and check in on site at UNB Fredericton. Teams may have one to four people.
- The [Devpost schedule](https://hack-atlantic-2026.devpost.com/details/dates) lists submissions ending **September 27 at 5:00 p.m. EDT** (6:00 p.m. Atlantic Daylight Time). The rules page still contains `[time] AT` placeholders, so confirm the final cutoff with an organizer and submit early.
- The rules request a project name, description, problem and build explanation, team names, a repository link, and any available screenshots, video, or live link. At least one team member must be present to demo for judging.
- The [overview](https://hack-atlantic-2026.devpost.com/) and detailed rules currently disagree about student eligibility. The published rules do not state an AI-assistance disclosure policy. Ask an organizer for the final eligibility and disclosure requirements.
- **User update:** The user confirmed organizers allow starting remotely as long as they attend, and organizers know they will arrive late. The local scaffold may proceed. The exact published hacking start time, final submission cutoff, and AI-assistance disclosure details still need confirmation from the event.

**Do:**

1. Confirm the event's start and submission times, eligibility rules, required links, and AI-assistance disclosure rules with the organizers.
2. Record the actual deadline and submission requirements in the project README or a short development log.
3. Keep the event-specific details out of product logic; the app's sample dates must stay relative to the user's local date.

**Done when:** The team knows when development and submission are allowed and what must be submitted.

## 1. Create the repository and app scaffold

**Do:**

1. Create the Next.js App Router project locally with TypeScript and a `src/` directory. The user will create or manage the GitHub repository.
2. Follow the folder structure in context section 10. Add the six route files, root layout, global styles, shared app shell, and placeholder states.
3. Configure `package.json` scripts for development, linting, building, and focused tests.
4. Add `.gitignore`, `.env.example`, and a README with local setup instructions. Keep real API keys out of Git.
5. Build responsive navigation: bottom bar on phones, sidebar on laptops, and a reduced-navigation Focus route.

**Done when:** All routes load locally, navigation works, and the app builds without secret values. GitHub setup is a separate user-managed step.

## 2. Deploy the empty working app

**User-managed step:** The assistant must not push to GitHub or deploy to Vercel. Keep building and checking the app locally until the user performs these remote actions.

**Do:**

1. Connect the GitHub repository to Vercel and deploy the scaffold before building complex features.
2. Open the production URL in an incognito browser and refresh a nested route such as `/plan`.
3. Set any required environment variable names in `.env.example`; put actual values only in local secrets and Vercel settings.
4. Keep deploying the same Vercel project as the app grows.

**Done when:** A public URL loads the app without a hosting-account login and nested-route refresh works.

## 3. Implement the schema, storage, and manual assignments

**Files:** `src/lib/schema/*`, `src/lib/persistence/storage.ts`, `src/store/app-store.ts`, `src/features/assignments/*`, assignment routes.

**Do:**

1. Define the persisted types from context section 7 and runtime validation for loaded data.
2. Initialize an empty state with a valid IANA timezone, `schemaVersion: 1`, and revision counters.
3. Load state after hydration; show a loading state until the welcome or returning route is known.
4. Save confirmed changes under one versioned `localStorage` key. Detect storage failure and changes from another tab.
5. Build manual add, edit, complete, reopen, and delete flows with the specified field limits and confirmations.
6. Keep unsaved form contents when a user backs out or an action fails. Preserve source information when extracted assignments are edited later.

**Done when:** A user can add and edit an assignment without AI, refresh the browser, and still see the correct data. Invalid or unsupported stored data shows a recovery path rather than being erased.

## 4. Implement availability and commitments

**Files:** `src/features/availability/*`, `src/app/availability/page.tsx`, `src/lib/time/timezone.ts`.

**Do:**

1. Show the detected timezone and editable proposed study windows. Require the user to review and save them before the first plan.
2. Add, edit, and delete one-off commitments. Validate each interval and split overnight commitments into two entries for P0.
3. Merge overlapping commitments for scheduling; keep their individual labels for display.
4. Explain timezone changes before saving them. Keep dated events at the same actual instant while weekly windows remain local clock times.
5. Mark the plan **Needs update** when scheduling inputs change.

**Done when:** Windows and commitments survive refresh, and invalid times cannot enter the scheduler.

## 5. Build and verify the deterministic scheduler

**Files:** `src/lib/scheduling/*`, `src/lib/demo/fixture.ts`, `tests/scheduler.test.ts`.

**Do:**

1. Expand weekly study windows into dated intervals in the plan timezone for the 14-local-day horizon.
2. Clip availability to now and the horizon, round inward to the 15-minute grid, and subtract the union of commitments.
3. Separate overdue and outside-horizon assignments. Sort eligible work by deadline, creation time, and ID.
4. Reserve an active Focus interval. Allocate remaining work before each deadline in chronological slots, grouping slots into configured sessions.
5. Keep partial allocations and record exact shortfalls. Validate that blocks do not overlap, enter blocked time, start in the past, or end after a deadline.
6. Test the fixed Halifax fixture from context section 11: initial six-hour fit, Tuesday shift causing a two-hour Maths shortfall, and Wednesday availability repairing it.
7. Add focused cases for overlapping commitments, a 15-minute final session, overdue work, horizon limits, and daylight-saving boundaries.

**Done when:** The fixed fixture and edge cases pass. The scheduler can run without React, browser storage, or an AI provider.

## 6. Build My Plan and the first complete setup journey

**Files:** `src/app/plan/page.tsx`, `src/features/planning/*`, `src/components/SetupChecklist.tsx`.

**Do:**

1. Connect Welcome → Assignments → Availability → Build my plan → My Plan.
2. Validate that at least one active assignment and confirmed availability exist before building.
3. Show plan status, one Next Up card, a phone agenda, a desktop weekly calendar, and assignment-specific shortfalls.
4. Distinguish deadlines, scheduled sessions, and remaining effort in text and layout.
5. Show overdue and outside-horizon work separately. Do not count outside-horizon work in an “All work fits” claim.
6. Provide useful empty, loading, and invalid-link states.

**Done when:** A first-time user can reach a useful plan from manual entry without spoken guidance. A shortfall remains visible while feasible sessions remain usable.

## 7. Add explicit replanning and change explanations

**Files:** `src/lib/scheduling/changes.ts`, `src/features/planning/PlanChanges.tsx`, central store transitions.

**Do:**

1. Increment `inputRevision` when deadlines, effort, windows, commitments, timezone, or session length change.
2. Mark an existing plan **Needs update** and prevent users from starting obsolete future blocks.
3. On Replan, build and validate a new future schedule in memory before replacing the saved plan.
4. Preserve completed history and work currently in Focus. Surface any conflict between active Focus and a new commitment.
5. Summarize moved, added, removed, and unscheduled sessions by assignment in plain language.
6. Mark missed uncompleted sessions as missed and offer Replan; never mark them complete automatically.

**Done when:** Adding the fixture's Tuesday shift shows a two-hour Maths shortfall; adding Wednesday availability repairs it. Deadlines and effort estimates never change on their own.

## 8. Build Focus, recovery, and session review

**Files:** `src/app/focus/[sessionId]/page.tsx`, `src/features/focus/*`, `tests/focus-review.test.ts`.

**Do:**

1. Permit only one running or paused Focus session. Redirect a second start attempt to resume or end the existing session.
2. Show one assignment, planned duration, elapsed time, notes on demand, pause/resume, End session, and Back to Plan.
3. Derive elapsed time from stored timestamps so refresh and background tabs do not corrupt the timer.
4. On return from a hidden tab or expired session, ask the user to confirm actual work time.
5. In review, ask for actual minutes worked, completion status, and remaining work when unfinished.
6. Save the work log and assignment update in one state transition, keyed by `focusId` to prevent a duplicate review. Recompute future work afterward.
7. Verify refresh, double-click, pause/resume, and a conflicting commitment during an active session.

**Done when:** Starting, pausing, resuming, ending, and reviewing a session works after refresh. Elapsed time never silently becomes completed work.

## 9. Add AI extraction and confirmation

**Files:** `src/app/api/extract-assignments/route.ts`, `src/lib/extraction/*`, `src/features/assignments/ExtractionReview.tsx`.

**Do:**

1. Build the paste form with the 12,000-character limit and a clear disclosure that text goes to an AI provider.
2. Validate the API request and model response. Limit the response to ten draft assignments and warn if source text appears to contain more.
3. Treat pasted content as data. Keep provider credentials on the server, add a timeout, controlled retry, and basic rate limiting.
4. Show proposed fields, source quotes, and ambiguity warnings. Require the user to confirm date, time, and remaining effort before saving.
5. Detect likely duplicates by title and deadline. Preserve pasted text on timeout or provider failure and offer manual entry.
6. Verify that no unreviewed AI draft enters the persisted assignment list.

**Done when:** Pasted instructions can produce reviewed assignments, and an unavailable AI provider leaves manual entry and existing plans usable.

## 10. Build the example experience and demonstration path

**Files:** `src/lib/demo/sample-data.ts`, Welcome route, Plan and Availability flows.

**Do:**

1. Generate synthetic assignments, commitments, and matching study windows relative to the user's local date.
2. Load an example into an empty state and label it **Example data** throughout the experience.
3. Confirm before an example replaces personal data, or before **Start my own plan** clears sample data.
4. Walk through the three-minute demo from context section 11: Next Up → new shift → shortfall → new availability → repaired plan → Focus.
5. End Focus early in the demo and record truthful worked minutes.

**Done when:** The example works regardless of today's date and never silently overwrites a personal plan.

## 11. Finish responsive design and accessibility

**Do:**

1. Review every page around 390px and 1440px. Use an agenda on phones and a weekly calendar on laptops.
2. Check labelled inputs, keyboard navigation, visible focus, dialog focus trapping, Escape behaviour, and touch targets around 44px.
3. Add text and icons to status colours, a polite live announcement for plan results, and reduced-motion support.
4. Confirm that save, extraction, and Replan buttons prevent duplicate submission and show real pending/error states.
5. Remove placeholder controls that do not work.

**Done when:** A new tester can create a plan and begin Focus using touch or keyboard without instructions.

## 12. Run end-to-end and production checks

**Do:**

1. Run the project's lint, focused tests, and production build. Fix failures that affect P0.
2. Test these flows in a fresh browser: personal setup, manual assignment, example setup, disruption/recovery, Focus review, AI failure, and refresh recovery.
3. Test missing/ambiguous extracted dates, overdue and outside-horizon work, overlapping commitments, invalid links, and unavailable browser storage.
4. Verify the deployed Vercel version in incognito and on a real phone over mobile data. Refresh a nested route.
5. Check GitHub for accidentally committed credentials and confirm Vercel environment values exist only in hosting settings.
6. Compare the result against every P0 acceptance item in context section 12. Record any unmet item honestly.

**Done when:** The released build supports the full core loop and its production URL works on phone and laptop.

## 13. Prepare submission and handoff

**Do:**

1. Add a concise README: problem, core flow, stack, local setup, environment variable names, production URL, and known limitations.
2. Capture screenshots and a short backup demo recording.
3. Rehearse the three-minute demo with the relative-date example.
4. Write a brief learning log: unfamiliar tools, a concrete challenge, what changed, and how it was verified.
5. The user submits the required GitHub and Vercel links before the event deadline, following the organizers' current rules. The assistant does not push or deploy.

**Done when:** The repository, production app, demo materials, and required disclosures are ready for review.

## If time runs short

1. Stop P1 work completely. Cut optional notes, decorative animation, and advanced calendar interactions.
2. Preserve manual entry, availability, deterministic scheduling, visible shortfalls, Replan, and Focus review.
3. Keep the example flow if it helps judges reach the core experience quickly.
4. If AI extraction is unfinished, leave manual entry working and disclose the missing feature rather than presenting a simulated live extraction.
5. Reserve the final window for production verification and submission. Do not trade it for an extra feature.

## P0 completion gate

The prototype is ready when a new user can open the Vercel URL, add or load work, confirm availability, see a feasible or partial plan, change a commitment, understand the resulting shortfall, start one Focus session, review real progress, and return to an updated plan. Data must survive refresh, and the same core flow must work on a phone and laptop.
