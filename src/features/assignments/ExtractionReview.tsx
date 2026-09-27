"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Assignment } from "@/lib/schema/types";
import { confirmedAssignment, duplicateAssignment, type ExtractionResult, type ReviewDraft } from "@/lib/extraction/drafts";
import { instantToLocalFields, localDateTimeToInstant } from "@/lib/time/timezone";

export function ExtractionReview({ timezone, assignments, onSave, onManual }: {
  timezone: string;
  assignments: Assignment[];
  onSave: (assignment: Assignment) => { ok: boolean; reason?: string };
  onManual: () => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [limitWarning, setLimitWarning] = useState(false);
  const [pending, setPending] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pendingRef = useRef(false);
  const requestVersion = useRef(0);
  const savedKeys = useRef(new Set<string>());
  const savingRef = useRef(false);

  async function extract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    if (!text.trim() || text.length > 12_000) { setError("Paste between 1 and 12,000 characters."); return; }
    pendingRef.current = true;
    const version = ++requestVersion.current;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const referenceDate = instantToLocalFields(new Date().toISOString(), timezone).date;
      const response = await fetch("/api/extract-assignments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, timezone, referenceDate }),
      });
      const result = await response.json();
      if (version !== requestVersion.current) return;
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Extraction failed. Try again or add an assignment manually.");
      const data = result as ExtractionResult;
      if (!Array.isArray(data.drafts)) throw new Error("Extraction returned an unreadable result. Try again or add an assignment manually.");
      setDrafts(data.drafts.map((draft) => ({ ...draft, id: crypto.randomUUID(), originalDate: draft.date,
        originalTime: draft.time, hours: "", minutes: "", confirmed: false, skipped: false })));
      setLimitWarning(data.limitWarning);
      if (data.drafts.length === 0) setMessage("No clear assignments found. Check the pasted text or add one manually.");
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : "Extraction failed. Try again or add an assignment manually.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function change(id: string, field: keyof ReviewDraft, value: string | boolean) {
    setDrafts((current) => current.map((draft) => draft.id === id
      ? { ...draft, [field]: value, confirmed: field === "confirmed" && value === true } : draft));
    setError("");
  }

  async function save(draft: ReviewDraft) {
    if (savingRef.current) return;
    setError("");
    setMessage("");
    try {
      const assignment = confirmedAssignment(draft, timezone, new Date().toISOString(), crypto.randomUUID());
      const key = `${assignment.title.trim().replace(/\s+/g, " ").toLocaleLowerCase()}|${assignment.dueAt}`;
      if (savedKeys.current.has(key) || duplicateAssignment(assignment.title, assignment.dueAt, assignments)) {
        setError("This title and deadline already exist. Skip this draft or change it before saving.");
        return;
      }
      savingRef.current = true;
      setSavingId(draft.id);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      const result = onSave(assignment);
      if (!result.ok) { setError(result.reason || "Could not save this assignment."); return; }
      savedKeys.current.add(key);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      setMessage(`Saved ${assignment.title}. Review another suggestion or use manual entry.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the assignment before saving.");
    } finally {
      savingRef.current = false;
      setSavingId(null);
    }
  }

  return (
    <section className="extraction-section" aria-labelledby="paste-heading">
      <div className="extraction-heading">
        <div><p className="eyebrow">From instructions</p><h2 id="paste-heading">Paste an assignment brief</h2></div>
        <button type="button" className="button button-secondary" onClick={onManual}>Add manually</button>
      </div>
      <p className="muted">AI will suggest assignments from your text. You review each deadline, choose a time, and estimate remaining work before saving.</p>
      <form onSubmit={extract} className="paste-form">
        <label htmlFor="assignment-paste">Instructions to extract</label>
        <textarea id="assignment-paste" rows={6} maxLength={12_000} value={text} onChange={(event) => {
          requestVersion.current++;
          setText(event.target.value);
          setDrafts([]);
          setLimitWarning(false);
          setMessage("");
        }} placeholder="Paste assignment instructions, a syllabus section, or a list of deadlines" />
        <p className="field-help">The text you paste is sent to Replicate for AI extraction. Do not include private information you do not want to send. {text.length.toLocaleString()}/12,000 characters.</p>
        <div className="action-row"><button className="button" type="submit" disabled={pending || savingId !== null || !text.trim()} aria-busy={pending}>{pending ? "Finding assignments…" : "Find assignments"}</button></div>
      </form>
      {limitWarning && <p className="extraction-warning" role="status">There may be more than 10 assignments here. Only the first 10 suggestions are shown. Split the text and check for anything missing.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="save-message" role="status">{message}</p>}
      {drafts.length > 0 && <div className="extraction-results">
        <div><p className="eyebrow">Review suggestions</p><h3>Check each assignment before saving</h3><p className="field-help">Suggested details can be wrong. Nothing below is saved until you confirm it.</p></div>
        {drafts.map((draft) => {
          const dueAt = localDateTimeToInstant(draft.date, draft.time, timezone);
          const duplicate = dueAt ? duplicateAssignment(draft.title, dueAt, assignments) : false;
          return <div className="extraction-draft" key={draft.id}>
            <div className="extraction-draft-heading"><strong>{draft.title || "Untitled assignment"}</strong><button type="button" className="text-button" onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}>Skip</button></div>
            {draft.excerpt && <p className="source-snippet"><span className="source-label">From your text</span><br />“{draft.excerpt}”</p>}
            {draft.deadlineQuote && <p className="field-help">Deadline wording: “{draft.deadlineQuote}”</p>}
            {draft.deadlineText && <p className="field-help">AI read the deadline as: {draft.deadlineText}</p>}
            {draft.warnings.map((warning, index) => <p className="extraction-warning" key={index}>{warning}</p>)}
            {duplicate && <p className="extraction-warning">You already have an assignment with this title and deadline. Skip it if it is the same work.</p>}
            <div className="review-fields">
              <label>Title<input maxLength={120} value={draft.title} onChange={(event) => change(draft.id, "title", event.target.value)} /></label>
              <label>Course <span className="optional">Optional</span><input maxLength={60} value={draft.course} onChange={(event) => change(draft.id, "course", event.target.value)} /></label>
              <label>Due date<input type="date" value={draft.date} onChange={(event) => change(draft.id, "date", event.target.value)} /></label>
              <label>Due time<input type="time" value={draft.time} onChange={(event) => change(draft.id, "time", event.target.value)} /></label>
              <label>Hours left<input type="number" min="0" max="10000" step="1" value={draft.hours} onChange={(event) => change(draft.id, "hours", event.target.value)} /></label>
              <label>Minutes left<input type="number" min="0" max="59" step="1" value={draft.minutes} onChange={(event) => change(draft.id, "minutes", event.target.value)} /></label>
            </div>
            <p className="field-help">Time zone: {timezone}. If no time was given, choose one yourself.</p>
            <label className="review-confirm"><input type="checkbox" checked={draft.confirmed} onChange={(event) => change(draft.id, "confirmed", event.target.checked)} /> I checked the deadline, time, and remaining work.</label>
            <button type="button" className="button" disabled={!draft.confirmed || duplicate || savingId !== null} aria-busy={savingId === draft.id} onClick={() => save(draft)}>{savingId === draft.id ? "Saving…" : "Save assignment"}</button>
          </div>;
        })}
      </div>}
    </section>
  );
}
