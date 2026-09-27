# Deadline Rescue

**A realistic study plan for deadlines that compete with classes, work, and life.** A task list can show what is due without showing whether there is enough time to finish it. Deadline Rescue schedules work into the hours a student is available, shows any shortfall, and gives them a next study session to start.

**Live app:** [deadline-rescue-lemon.vercel.app](https://deadline-rescue-lemon.vercel.app/)

## Core flow

1. Add assignments manually, or paste a brief and review AI suggestions. Confirm each deadline, time, title, and estimate of work left before saving.
2. Set weekly study hours and add fixed commitments such as classes or shifts. Study hours mean *available* time; the plan chooses specific sessions within them.
3. Build a 14-day plan. My Plan shows upcoming sessions and work that cannot fit before its deadline. Change a commitment or study window and select **Replan** to see what moved.
4. Start a current Focus session, pause or resume it, then review the minutes actually worked. The app updates remaining work and the plan.

New visitors can choose **Try an example** to see a shift create a shortfall and extra study hours resolve it. No account is needed.

## Stack and local setup

- Next.js, React, and TypeScript for the web app.
- A deterministic scheduling engine for study sessions and shortfalls.
- Versioned browser `localStorage` for assignments, availability, plans, and Focus progress.
- Replicate's `meta/meta-llama-3-70b-instruct` model for optional assignment extraction. The server holds the API token; students must review its suggestions.

Use Node.js 20.9 or newer. In this folder, run:

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution is disabled. Run `npm test`, `npm run lint`, and `npm run build` to check the project.

### Environment variable

| Name | Where to set it | Purpose |
| --- | --- | --- |
| `REPLICATE_API_TOKEN` | Local `.env.local`; Vercel project environment settings for the deployed app | Enables optional AI extraction. Manual entry, planning, and Focus work without it. |

Copy the variable name from [`.env.example`](.env.example), add your own token to `.env.local`, and restart the dev server. Keep the real token out of Git. Pasted briefs and the reference date/time zone are sent to Replicate when AI extraction is used.

## Known limitations

- Plans are stored in each browser. They do not sync between devices, and clearing browser storage removes them. Accounts and a hosted database are not part of this version.
- The plan covers the next 14 days and depends on the deadlines, work estimates, and availability entered by the student. It may show work that cannot fit; it does not guarantee completion.
- AI extraction can miss or misread details. Students must check suggestions and supply missing titles, deadlines, times, and effort before saving. Manual entry remains available if AI fails.
- There are no calendar integrations or notifications. The AI endpoint has a basic per-instance rate limit, which is not intended for high traffic.

For the product specification, see [context](Deadline_Rescue_Context.md). For the build phases and remaining release checks, see [development plan](Deadline_Rescue_Development_Plan.md) and [Phase 12 verification](PHASE_12_VERIFICATION.md).
