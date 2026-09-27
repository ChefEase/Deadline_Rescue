# Deadline Rescue

**Deadline Rescue helps students see what to work on next.** The idea is simple: enter assignments and the time you can study, get a realistic plan, then focus on one study session at a time. If your schedule changes, the app will explain what still fits and what needs attention.

## What can I do with it?

The planned experience is:

1. Add an assignment or paste its instructions.
2. Confirm the deadline and estimate the work left.
3. Set your study hours and add classes, shifts, or other commitments.
4. View a plan that shows your next study session and any work that could not fit.
5. Focus on one session, record your actual progress, and update the plan.

The app is designed for one person. It does not require an account. Plans are intended to be saved in the browser you use, so they will not automatically appear on another device.

## Current progress

**The setup journey, My Plan, replanning, Focus, and reviewed AI extraction are available locally.** You can add assignments manually or paste instructions for AI suggestions, confirm study hours, add fixed commitments, and build a 14-day plan. AI suggestions are saved only after you review and confirm each deadline, time, and work estimate. Changes to scheduling inputs mark the plan as needing an update; Replan explains what changed. During a current session, Focus can run, pause, resume after refresh, and ask you to confirm actual work before saving progress and updating the plan. Saved work stays in this browser, with a recovery screen for invalid saved data.

The detailed product specification is in [Deadline_Rescue_Context.md](Deadline_Rescue_Context.md). The build order and completion checks are in [Deadline_Rescue_Development_Plan.md](Deadline_Rescue_Development_Plan.md).

## Why this project exists

Deadlines can be hard to manage when assignments, classes, work, and personal plans compete for the same hours. A task list shows what is due, but it does not always show whether there is enough time. Deadline Rescue aims to make that gap visible and give students one clear next action.

## For developers

The app uses Next.js, React, and TypeScript. The first version is designed to keep data in the browser with `localStorage`. GitHub is the intended source repository, and Vercel is the intended host, but this local workspace has not been pushed or deployed.

To run it locally:

1. Install Node.js 20.9 or newer.
2. In this folder, run `npm install`.
3. Run `npm run dev` and open `http://localhost:3000`.

On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is disabled. For example, run `npm.cmd run dev`.

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run lint` | Check code style and common mistakes |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run the scheduler, Focus, and extraction tests |
| `npm run build` | Create a production build locally |

Manual entry, planning, and Focus need no API key. To use AI extraction, create a Replicate API token and put `REPLICATE_API_TOKEN=your_token` in `.env.local`, then restart the local development server. The server calls Replicate's official `meta/meta-llama-3-70b-instruct` model. Pasted text and its reference date/time zone go to Replicate; saved assignments remain in this browser. Without a token, the paste form explains that extraction is unavailable and manual entry still works.

### Phase 2 deployment handoff

Import the GitHub repository into Vercel as a Next.js project. Manual features have no required environment variables or custom build settings. Deploy the repository's intended branch, then open the public URL in a private browser window. Refresh `/plan` directly and confirm it still loads without a hosting-account login.

Keep future deployments on the same Vercel project. To enable AI extraction there, add `REPLICATE_API_TOKEN` in the project environment settings. The in-memory request limit is basic per server instance, so a public high-traffic deployment needs a shared rate limiter.

## Project boundaries

This hackathon version does not include accounts, cross-device sync, calendar integrations, notifications, or guaranteed deadline completion. Scheduling will use the work estimates and availability entered by the user. The app cannot know whether an assignment is truly finished until the user confirms it.
