"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatDue, formatEffort } from "@/features/assignments/AssignmentList";
import type { AppState } from "@/lib/schema/types";
import { useAppStore } from "@/store/app-store";
import { elapsedFocusSeconds, endFocus, focusBlockForRoute, pauseFocus, resumeFocus, reviewFocus, startFocus } from "./focus-state";

const FRESH_FOCUS_KEY = "deadline-rescue:fresh-focus";

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function returningToFocus(focusId: string | undefined): boolean {
  if (!focusId) return false;
  try {
    return window.sessionStorage.getItem(FRESH_FOCUS_KEY) !== focusId;
  } catch { return true; }
}

export function FocusView({ sessionId }: { sessionId: string }) {
  const { state, mutate } = useAppStore();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date().toISOString());
  const [returnChoice, setReturnChoice] = useState(() => returningToFocus(state?.activeFocus?.id));
  const [wasHidden, setWasHidden] = useState(false);
  const [error, setError] = useState("");
  const [actualMinutes, setActualMinutes] = useState("");
  const [remainingMinutes, setRemainingMinutes] = useState("");
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const initializedReview = useRef<string | null>(null);
  const hiddenRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().toISOString()), 1000);
    const onVisibility = () => {
      if (document.hidden) hiddenRef.current = true;
      else {
        setNow(new Date().toISOString());
        if (hiddenRef.current) setWasHidden(true);
        hiddenRef.current = false;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  const focus = state?.activeFocus;
  const block = state ? focusBlockForRoute(state, sessionId) : undefined;
  const assignment = state?.assignments.find((item) => item.id === block?.assignmentId);
  const elapsed = focus ? elapsedFocusSeconds(focus, now) : 0;
  const plannedSeconds = block ? Math.floor((Date.parse(block.endAt) - Date.parse(block.startAt)) / 1000) : 0;
  const expired = Boolean(block && block.endAt <= now);
  const planCurrent = Boolean(state?.plan && state.plan.inputRevision === state.inputRevision &&
    state.plan.horizonEndAt > now && !state.plan.blocks.some((item) => item.state === "scheduled" && item.endAt <= now));
  const earlyExampleStart = Boolean(state?.mode === "example" && block &&
    Date.parse(block.startAt) - Date.parse(now) <= 15 * 60_000);
  const canStart = Boolean(block && block.state === "scheduled" && (block.startAt <= now || earlyExampleStart) && !expired && planCurrent);

  useEffect(() => {
    if (!focus) return;
    try { window.sessionStorage.removeItem(FRESH_FOCUS_KEY); } catch { /* The session remains saved in the document. */ }
  }, [focus]);

  useEffect(() => {
    if (!focus || focus.state !== "review" || !assignment || initializedReview.current === focus.id) return;
    initializedReview.current = focus.id;
    // Timer time is a suggestion only; the student confirms actual work and effort left.
    const suggested = Math.min(1440, Math.round(elapsedFocusSeconds(focus, new Date().toISOString()) / 60));
    setActualMinutes(String(suggested));
    setRemainingMinutes(String(Math.max(0, assignment.remainingMinutes - suggested)));
  }, [focus, assignment]);

  if (!state) return null;
  if (!block || !assignment) {
    return <section className="focus-card"><p className="eyebrow">Focus</p><h1>Session not found</h1><p>This link does not match a saved study session in this browser.</p><Link className="button" href="/plan">Back to My Plan</Link></section>;
  }

  function apply(change: () => AppState): boolean {
    setError("");
    try {
      const result = mutate(() => change());
      if (result.ok) { setNow(new Date().toISOString()); return true; }
      setError(result.reason);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Focus could not be updated."); }
    return false;
  }

  function start() {
    const focusId = crypto.randomUUID();
    if (apply(() => startFocus(state!, block!.id, focusId, new Date().toISOString()))) {
      setReturnChoice(false);
      setWasHidden(false);
    }
  }
  function pause() { apply(() => pauseFocus(state!, new Date().toISOString())); }
  function resume() {
    if (apply(() => resumeFocus(state!, new Date().toISOString()))) {
      setReturnChoice(false);
      setWasHidden(false);
    }
  }
  function end() {
    if (apply(() => endFocus(state!, new Date().toISOString()))) {
      setReturnChoice(false);
      setWasHidden(false);
    }
  }
  function backToPlan() {
    if (focus?.state === "running" && !apply(() => pauseFocus(state!, new Date().toISOString()))) return;
    router.push("/plan");
  }

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!focus || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    let saved = false;
    try {
      const reviewed = reviewFocus(state!, {
        focusId: focus.id, logId: crypto.randomUUID(), actualMinutes: Number(actualMinutes),
        finished, remainingMinutes: finished ? null : Number(remainingMinutes),
      }, new Date().toISOString());
      const result = mutate(() => reviewed);
      if (!result.ok) { setError(result.reason); return; }
      saved = true;
      try { window.sessionStorage.setItem("deadline-rescue:focus-reviewed", "true"); } catch { /* Saved progress is still available in the plan. */ }
      router.push("/plan");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Progress could not be saved."); }
    finally { if (!saved) { savingRef.current = false; setSaving(false); } }
  }

  return <section className="focus-card">
    <button className="text-button focus-back" onClick={backToPlan}>← Back to Plan</button>
    <p className="eyebrow">Focus · one session</p>
    <h1>{assignment.title}</h1>
    {assignment.course && <p className="focus-course">{assignment.course}</p>}
    <div className="focus-facts">
      <div><span>Planned session</span><strong>{formatEffort(plannedSeconds / 60)}</strong></div>
      <div><span>Assignment deadline</span><strong>{formatDue(assignment.dueAt, state.timezone)}</strong></div>
    </div>
    {assignment.notes && <details className="focus-notes"><summary>Show assignment notes</summary><p>{assignment.notes}</p></details>}
    {error && <p className="form-error" role="alert">{error}</p>}

    {!focus && <div className="focus-state">
      <h2>{canStart ? "Ready to begin?" : "This session cannot start now"}</h2>
      <p>{canStart ? "Your plan is ready. Focus tracks time here; you confirm your actual work when you finish."
        : !planCurrent ? "Replan from My Plan before using saved sessions."
        : block.state !== "scheduled" ? "This session was already completed or missed."
          : block.startAt > now ? "The planned start time has not arrived yet."
            : "This planned session has ended. Replan from My Plan."}</p>
      {canStart && <button className="button" onClick={start}>Start Focus</button>}
    </div>}

    {focus && focus.state !== "review" && <>
      <div className="focus-timer" aria-label={`Elapsed focus time ${clock(elapsed)}`}>
        <span>Time spent in this session</span><strong>{clock(elapsed)}</strong>
        <p>{expired || elapsed >= plannedSeconds ? "Time to review your progress." : `${clock(Math.max(0, plannedSeconds - elapsed))} of planned time left`}</p>
      </div>
      {(returnChoice || wasHidden) && <div className="focus-return" role="status">
        <h2>{expired ? "Your planned time ended" : "Welcome back"}</h2>
        <p>The timer uses saved time. You will confirm how long you actually worked before anything counts as progress.</p>
        <div className="action-row">
          {!expired && (focus.state === "paused"
            ? <button className="button" onClick={resume}>Resume Focus</button>
            : <button className="button" onClick={() => { setReturnChoice(false); setWasHidden(false); }}>Continue Focus</button>)}
          <button className="button button-secondary" onClick={end}>Review work now</button>
        </div>
      </div>}
      {!returnChoice && !wasHidden && <div className="focus-actions">
        {!expired && (focus.state === "running" ? <button className="button button-secondary" onClick={pause}>Pause</button> : <button className="button" onClick={resume}>Resume</button>)}
        <button className="button" onClick={end}>{expired ? "Review progress" : "End session"}</button>
      </div>}
    </>}

    {focus?.state === "review" && <form className="focus-review" onSubmit={saveReview}>
      <p className="eyebrow">Session review</p><h2>What did you get done?</h2>
      <p>The timer is only a suggestion. Enter the time you actually worked.</p>
      <label>Minutes actually worked
        <input type="number" min="0" max="1440" step="1" required value={actualMinutes} onChange={(event) => setActualMinutes(event.target.value)} />
      </label>
      <fieldset>
        <legend>Is this assignment finished?</legend>
        <label><input type="radio" name="finished" checked={!finished} onChange={() => setFinished(false)} /> No, work remains</label>
        <label><input type="radio" name="finished" checked={finished} onChange={() => setFinished(true)} /> Yes, it is finished</label>
      </fieldset>
      {!finished && <label>Minutes of work still remaining
        <input type="number" min="1" step="1" required value={remainingMinutes} onChange={(event) => setRemainingMinutes(event.target.value)} />
      </label>}
      {!finished && Number(remainingMinutes) === 0 && <p className="field-help">If no work remains, choose “Yes, it is finished.”</p>}
      <button className="button" type="submit" disabled={saving} aria-busy={saving}>{saving ? "Saving…" : "Save progress and update plan"}</button>
    </form>}
  </section>;
}
