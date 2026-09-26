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

**This repository currently contains the app scaffold.** The welcome screen, navigation, and six page routes are in place. Assignment entry, scheduling, AI extraction, and Focus timing are still being built. The current screens are placeholders and should not be treated as a finished study planner.

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
| `npm run build` | Create a production build locally |

No API key is needed for the scaffold. The future AI extraction endpoint will require a provider key kept in a local `.env.local` file or hosting settings, never in the repository.

## Project boundaries

This hackathon version does not include accounts, cross-device sync, calendar integrations, notifications, or guaranteed deadline completion. Scheduling will use the work estimates and availability entered by the user. The app cannot know whether an assignment is truly finished until the user confirms it.
