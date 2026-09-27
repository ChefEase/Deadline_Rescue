# Phase 12 verification

Local checks were run on 2026-09-27. The production URL is https://deadline-rescue-lemon.vercel.app/. The user reported that the deployed app works on a phone over Wi-Fi and in an incognito browser. Each browser showed a separate plan, as expected for browser-local storage.

## Passed locally

- `npm.cmd run lint` passed.
- `npm.cmd test` passed all 30 tests, including the new persistence and AI response-format checks.
- `npm.cmd run build` produced the production routes, including `/plan`, `/assignments/[id]`, and `/focus/[sessionId]`.
- A direct HTTP request to the running local `/plan` route returned 200.
- Automated checks cover the example disruption and recovery, overlapping commitments, overdue and outside-horizon work, Focus review and refresh, ambiguous extracted deadlines, unavailable browser storage, and provider errors.
- The current `REPLICATE_API_TOKEN` value in `.env.local` was absent from all 11 local Git commits. `.env.local` is ignored; `.env.example` is the only tracked environment file.
- GitHub `main` matched the clean local `HEAD` at `8d7a7f3` after the AI parsing fix was committed.

## Production checks

- Independent HTTP requests to `/`, `/plan`, `/assignments`, `/availability`, `/assignments/does-not-exist`, and `/focus/does-not-exist` all returned 200 from the public URL.
- The public extraction endpoint rejected an invalid request with HTTP 400, without calling Replicate.
- The user opened the deployed app on a phone over Wi-Fi and in an incognito browser; both worked and showed separate plans. The user also confirmed that `/plan` loads after a direct refresh and that the AI 502 is gone.
- A phone test over cellular data was not possible because the user's phone did not connect with Wi-Fi disabled. This is an untested network condition, not evidence that the app failed.

## Still to verify before calling Phase 12 complete

- In a fresh browser profile, run personal setup and manual assignment entry. Refresh after saving assignments, study hours, and commitments.
- Run **Try an example**, add its suggested shift, replan to see the shortfall, add the suggested study window, and replan again. Start Focus, pause, resume, end, and review actual minutes. Refresh during Focus and after review.
- Test AI extraction with a brief missing a due time and with an ambiguous date. Confirm that neither saves until corrected. Disconnect the network or use an invalid test token to check the error message and manual-entry fallback; restore the real token afterward.
- Open invalid `/assignments/does-not-exist` and `/focus/does-not-exist` links in a browser. Both should show a way back. Test once with browser storage blocked; the app should warn that work may be lost on refresh.
- Check keyboard and touch interaction and the actual layout around 390px and 1440px. These visual checks were not completed by automated tests.
- If cellular data becomes available, open the public URL on the phone with Wi-Fi off. This specific network check remains untested.
- Check Vercel's deployment details for the exact source commit and confirm that `REPLICATE_API_TOKEN` exists only in Vercel project settings, not in a committed file. The app works with AI according to the user's retest, but the hosting settings are not visible from the public URL.

The public app and core routes are reachable, and the reported phone, incognito, direct-refresh, and AI checks pass. The full Phase 12 manual acceptance checklist above remains open where no result has been reported. Browser data is stored per device, so work entered on the laptop will not automatically appear on the phone.

## AI extraction regression found after deployment

A live Replicate prediction succeeded but returned a short introduction and code fence around JSON, with an empty title. The original deployed parser returned HTTP 502. The parser now extracts the complete JSON object for review and flags the missing title, which still must be filled before saving. The regression test, lint, and production build pass locally. The user reports that the AI 502 is gone on the public app.
