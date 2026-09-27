# Phase 12 verification

Checked on 2026-09-27 in the local workspace. No packages were installed, and nothing was pushed or deployed.

## Passed locally

- `npm.cmd run lint` passed.
- `npm.cmd test` passed all 29 tests, including the new persistence and AI failure checks.
- `npm.cmd run build` produced the production routes, including `/plan`, `/assignments/[id]`, and `/focus/[sessionId]`.
- A direct HTTP request to the running local `/plan` route returned 200.
- Automated checks cover the example disruption and recovery, overlapping commitments, overdue and outside-horizon work, Focus review and refresh, ambiguous extracted deadlines, unavailable browser storage, and provider errors.
- The current `REPLICATE_API_TOKEN` value in `.env.local` was absent from all 10 local Git commits. `.env.local` is ignored; `.env.example` is the only tracked environment file.
- GitHub `main` matched local `HEAD` at `3235fba` when checked. The current Phase 11 and 12 edits are **not yet on GitHub**.

## Still to verify before calling Phase 12 complete

- In a fresh browser profile, run personal setup and manual assignment entry. Refresh after saving assignments, study hours, and commitments.
- Run **Try an example**, add its suggested shift, replan to see the shortfall, add the suggested study window, and replan again. Start Focus, pause, resume, end, and review actual minutes. Refresh during Focus and after review.
- Test AI extraction with a brief missing a due time and with an ambiguous date. Confirm that neither saves until corrected. Disconnect the network or use an invalid test token to check the error message and manual-entry fallback; restore the real token afterward.
- Open invalid `/assignments/does-not-exist` and `/focus/does-not-exist` links in a browser. Both should show a way back. Test once with browser storage blocked; the app should warn that work may be lost on refresh.
- Check keyboard and touch interaction and the actual layout around 390px and 1440px. These visual checks were not completed by automated tests.
- After **you** push and deploy, verify the public Vercel URL in an incognito browser and on a phone over mobile data. Refresh `/plan` directly. Check that Vercel points to the intended GitHub branch and that `REPLICATE_API_TOKEN` is set only in Vercel project settings, not in a committed file.

The release gate remains open until the fresh-browser and production checks pass. Browser data is stored per device, so work entered on the laptop will not automatically appear on the phone.
