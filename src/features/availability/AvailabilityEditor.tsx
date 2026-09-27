"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Commitment, StudyWindow } from "@/lib/schema/types";
import { newAppState } from "@/lib/persistence/storage";
import { instantToLocalFields, isValidTimezone } from "@/lib/time/timezone";
import { useAppStore } from "@/store/app-store";
import { SetupChecklist } from "@/components/SetupChecklist";
import { buildPlanForState } from "@/features/planning/build-plan";
import { buildCommitments, displayStudyWindowEnd, normalizeStudyWindowEnd, proposedStudyWindows, validateWindows, WEEKDAYS, type CommitmentInput } from "./availability";
import { CommitmentForm } from "./CommitmentForm";

function formatCommitment(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, dateStyle: "medium", timeStyle: "short",
  }).format(new Date(instant));
}

export function AvailabilityEditor() {
  const { state, mutate } = useAppStore();
  const router = useRouter();
  const buildingRef = useRef(false);
  const [windows, setWindows] = useState<StudyWindow[]>(() => state?.studyWindows.length
    ? state.studyWindows : proposedStudyWindows());
  const [timezone, setTimezone] = useState(() => state?.timezone || "UTC");
  const [sessionMinutes, setSessionMinutes] = useState(() => String(state?.preferences.sessionMinutes || 30));
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [asOf] = useState(() => Date.now());
  if (!state) return null;
  const savedState = state;

  const zonePending = timezone.trim() !== state.timezone;
  const availabilityDraftChanged = zonePending || Number(sessionMinutes) !== state.preferences.sessionMinutes ||
    JSON.stringify(windows) !== JSON.stringify(state.studyWindows);
  const sortedCommitments = [...state.commitments].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const upcoming = sortedCommitments.filter((item) => new Date(item.endAt).getTime() >= asOf);
  const past = sortedCommitments.filter((item) => new Date(item.endAt).getTime() < asOf);

  function updateWindow(id: string, change: Partial<StudyWindow>) {
    setWindows((current) => current.map((window) => window.id === id ? { ...window, ...change } : window));
    setMessage("");
    setError("");
  }

  function addWindow(weekday: StudyWindow["weekday"]) {
    setWindows((current) => [...current, {
      id: crypto.randomUUID(), weekday, localStart: "16:00", localEnd: "18:00", enabled: true,
    }]);
    setMessage("");
  }

  function saveAvailability() {
    setMessage("");
    const issue = validateWindows(windows);
    if (issue) { setError(issue); return; }
    const zone = timezone.trim();
    if (!isValidTimezone(zone)) { setError("Enter a valid IANA timezone, such as America/Halifax."); return; }
    const session = Number(sessionMinutes);
    if (!Number.isSafeInteger(session) || session < 15 || session % 15 !== 0) {
      setError("Session length must be a positive multiple of 15 minutes.");
      return;
    }
    if (zonePending && !window.confirm(
      "Change the plan timezone? Saved deadlines and commitments will keep their actual instants and display in the new timezone. Weekly study hours will keep their local clock times. Your plan will need an update.",
    )) return;

    const inputsChanged = zone !== savedState.timezone || session !== savedState.preferences.sessionMinutes ||
      JSON.stringify(windows) !== JSON.stringify(savedState.studyWindows);
    // Dated deadlines and commitments remain UTC instants; only their display zone changes.
    const result = mutate((current) => ({
      ...current,
      timezone: zone,
      preferences: { ...current.preferences, sessionMinutes: session },
      studyWindows: windows,
      availabilityConfirmedAt: new Date().toISOString(),
      inputRevision: current.inputRevision + (inputsChanged ? 1 : 0),
    }));
    if (result.ok) { setError(""); setMessage("Study hours saved in this browser."); }
    else setError(result.reason);
  }

  function buildFromAvailability() {
    if (buildingRef.current) return;
    buildingRef.current = true;
    setError("");
    try {
      const plan = buildPlanForState(savedState, new Date().toISOString());
      const result = mutate((current) => ({ ...current, plan }));
      if (result.ok) router.push("/plan");
      else setError(result.reason);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The plan could not be built.");
    } finally {
      buildingRef.current = false;
    }
  }

  function saveCommitment(input: CommitmentInput) {
    const entries = buildCommitments(input, savedState.timezone);
    if (!entries) return { ok: false, reason: "Check the title, date, and times. Start and end cannot be equal, and clock-change times may be unavailable." };
    if (editing) entries[0].id = editing.id;
    const result = mutate((current) => ({
      ...current,
      commitments: [...current.commitments.filter((item) => item.id !== editing?.id), ...entries],
      inputRevision: current.inputRevision + 1,
    }));
    if (result.ok) { setEditing(null); setError(""); setMessage(entries.length === 2 ? "Overnight commitment saved as two entries." : "Commitment saved."); }
    return result;
  }

  function deleteCommitment(commitment: Commitment) {
    if (!window.confirm(`Delete “${commitment.title}” on ${formatCommitment(commitment.startAt, savedState.timezone)}?`)) return;
    const result = mutate((current) => ({
      ...current,
      commitments: current.commitments.filter((item) => item.id !== commitment.id),
      inputRevision: current.inputRevision + 1,
    }));
    if (result.ok) { setError(""); setMessage("Commitment deleted."); }
    else setError(result.reason);
  }

  function resetAll() {
    if (!window.confirm("Delete every assignment, study window, commitment, plan, and work log saved in this browser? This cannot be undone.")) return;
    const result = mutate(() => newAppState());
    if (result.ok) {
      const fresh = newAppState();
      setWindows(proposedStudyWindows());
      setTimezone(fresh.timezone);
      setSessionMinutes(String(fresh.preferences.sessionMinutes));
      setEditing(null);
      setCommitmentOpen(false);
      setError("");
      setMessage("Browser data cleared. Review the suggested study hours before saving.");
    } else setError(result.reason);
  }

  function renderCommitment(item: Commitment) {
    const localStart = instantToLocalFields(item.startAt, state!.timezone);
    return (
      <li key={item.id} className="commitment-row">
        <div>
          <strong>{item.title}</strong>
          <p>{formatCommitment(item.startAt, state!.timezone)} – {formatCommitment(item.endAt, state!.timezone)}</p>
          <span className="commitment-meta">{item.category || "Uncategorized"} · {localStart.date}</span>
        </div>
        <div className="commitment-actions">
          <button className="button button-secondary" onClick={() => { setEditing(item); setCommitmentOpen(true); }}>Edit</button>
          <button className="text-button danger-text" onClick={() => deleteCommitment(item)}>Delete</button>
        </div>
      </li>
    );
  }

  return (
    <div className="availability-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Availability</p>
          <h1>Make room for real life.</h1>
          <p>Choose when you can study, then block the time you cannot.</p>
        </div>
      </header>
      {!state.plan && <SetupChecklist state={state} />}

      {!state.availabilityConfirmedAt && <p className="availability-notice" role="status">These hours are suggestions. Review and save them before building your first plan.</p>}
      {state.plan && state.plan.inputRevision !== state.inputRevision && <p className="availability-notice attention" role="status">Your plan needs an update because its scheduling inputs changed.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="save-message" role="status">{message}</p>}

      <div className="availability-layout">
        <section className="availability-section">
          <div className="section-heading">
            <div><h2>Weekly study hours</h2><p>Time outside enabled windows stays unavailable.</p></div>
          </div>
          <p className="field-help">An end time of 12:00 a.m. means midnight at the end of that day. For later overnight hours, add a window on the next day.</p>
          <div className="weekdays">
            {WEEKDAYS.map((day, index) => {
              const weekday = (index + 1) as StudyWindow["weekday"];
              const dayWindows = windows.filter((item) => item.weekday === weekday);
              return (
                <div className="weekday-group" key={day}>
                  <div className="weekday-heading"><h3>{day}</h3><button className="text-button" onClick={() => addWindow(weekday)}>Add window</button></div>
                  {dayWindows.length === 0 && <p className="field-help">No study hours on this day.</p>}
                  {dayWindows.map((window) => (
                    <div className="study-window-row" key={window.id}>
                      <label className="enabled-label"><input type="checkbox" checked={window.enabled} onChange={(event) => updateWindow(window.id, { enabled: event.target.checked })} /><span>Use</span></label>
                      <label>From <input aria-label={`${day} study start`} type="time" value={window.localStart} onChange={(event) => updateWindow(window.id, { localStart: event.target.value })} /></label>
                      <label>To <input aria-label={`${day} study end`} type="time" value={displayStudyWindowEnd(window.localEnd)} onChange={(event) => updateWindow(window.id, { localEnd: normalizeStudyWindowEnd(event.target.value) })} /></label>
                      <button className="text-button danger-text" onClick={() => { setWindows((current) => current.filter((item) => item.id !== window.id)); setMessage(""); }}>Remove</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="availability-settings">
            <h2>Plan settings</h2>
            <label>
              Plan timezone
              <input list="timezones" value={timezone} onChange={(event) => { setTimezone(event.target.value); setMessage(""); }} />
              <datalist id="timezones"><option value="America/Halifax" /><option value="America/Toronto" /><option value="America/Vancouver" /><option value="UTC" /></datalist>
            </label>
            <p className="field-help">Detected timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"}. Use a valid IANA timezone.</p>
            {zonePending && <p className="availability-notice">Deadlines and commitments keep their actual instants. Weekly study hours keep the same local clock times.</p>}
            <label>
              Session length (minutes)
              <input type="number" min="15" step="15" value={sessionMinutes} onChange={(event) => { setSessionMinutes(event.target.value); setMessage(""); }} />
            </label>
          </div>
          <div className="action-row">
            <button className="button" onClick={saveAvailability}>Save availability</button>
            {!state.plan && state.availabilityConfirmedAt && state.assignments.some((assignment) => assignment.status === "active") && (
              <button className="button button-secondary" disabled={availabilityDraftChanged} onClick={buildFromAvailability}>Build my plan</button>
            )}
          </div>
          {availabilityDraftChanged && state.availabilityConfirmedAt && <p className="field-help">Save these changes before building a plan.</p>}
        </section>

        <section className="availability-section commitment-section">
          <div className="section-heading">
            <div><h2>Fixed commitments</h2><p>Classes, shifts, and plans that block study time.</p></div>
            <button className="button button-secondary" disabled={zonePending} onClick={() => { setEditing(null); setCommitmentOpen(true); }}>Add commitment</button>
          </div>
          {zonePending && <p className="field-help">Save the timezone change before adding a commitment.</p>}
          {upcoming.length === 0 ? <div className="empty-state"><h3>No upcoming commitments</h3><p>Add a class, shift, or personal plan when you know it.</p></div> : <ul className="commitment-list">{upcoming.map(renderCommitment)}</ul>}
          {past.length > 0 && <details className="past-commitments"><summary>Past commitments ({past.length})</summary><ul className="commitment-list">{past.map(renderCommitment)}</ul></details>}
          <p className="field-help">Overlapping commitments stay separate here. The scheduler will count their shared time only once.</p>
        </section>
      </div>

      <div className="data-reset"><button className="text-button danger-text" onClick={resetAll}>Clear all browser data</button></div>
      <CommitmentForm
        key={editing ? `${editing.id}:${editing.startAt}:${editing.endAt}` : "new"}
        open={commitmentOpen}
        timezone={state.timezone}
        commitment={editing || undefined}
        onClose={() => setCommitmentOpen(false)}
        onSave={saveCommitment}
      />
    </div>
  );
}
