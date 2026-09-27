# Phase 12 verification

Local checks were run on 2026-09-27. The user reported deploying afterward. This report separates checks verified locally from live deployment checks still requiring the public URL or a real device.

## Passed locally

- `npm.cmd run lint` passed.
- `npm.cmd test` passed all 29 tests, including the new persistence and AI failure checks.
- `npm.cmd run build` produced the production routes, including `/plan`, `/assignments/[id]`, and `/focus/[sessionId]`.
- A direct HTTP request to the running local `/plan` route returned 200.
- Automated checks cover the example disruption and recovery, overlapping commitments, overdue and outside-horizon work, Focus review and refresh, ambiguous extracted deadlines, unavailable browser storage, and provider errors.
- The current `REPLICATE_API_TOKEN` value in `.env.local` was absent from all 11 local Git commits. `.env.local` is ignored; `.env.example` is the only tracked environment file.
- GitHub `main` matched the clean local `HEAD` at `06eec9f` after the user reported deploying. This confirms the source was pushed; it does not confirm which commit Vercel serves.

## Still to verify before calling Phase 12 complete

- In a fresh browser profile, run personal setup and manual assignment entry. Refresh after saving assignments, study hours, and commitments.
- Run **Try an example**, add its suggested shift, replan to see the shortfall, add the suggested study window, and replan again. Start Focus, pause, resume, end, and review actual minutes. Refresh during Focus and after review.
- Test AI extraction with a brief missing a due time and with an ambiguous date. Confirm that neither saves until corrected. Disconnect the network or use an invalid test token to check the error message and manual-entry fallback; restore the real token afterward.
- Open invalid `/assignments/does-not-exist` and `/focus/does-not-exist` links in a browser. Both should show a way back. Test once with browser storage blocked; the app should warn that work may be lost on refresh.
- Check keyboard and touch interaction and the actual layout around 390px and 1440px. These visual checks were not completed by automated tests.
- Verify the public Vercel URL in an incognito browser and on a phone over mobile data. Refresh `/plan` directly. Check that Vercel points to the intended GitHub branch and that `REPLICATE_API_TOKEN` is set only in Vercel project settings, not in a committed file. The URL is not recorded in this repository, so these checks have not been run yet.

The release gate remains open until the fresh-browser and production checks pass. Browser data is stored per device, so work entered on the laptop will not automatically appear on the phone.

## AI extraction regression found after deployment

A live Replicate prediction succeeded but returned a short introduction and code fence around JSON, with an empty title. The deployed parser returned HTTP 502. The local parser now extracts the complete JSON object for review and flags the missing title, which still must be filled before saving. The regression test, lint, and production build pass locally. This fix still needs to be pushed, redeployed, and tried on the public app.
