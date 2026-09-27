"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Assignment } from "@/lib/schema/types";
import { instantToLocalFields, localDateTimeToInstant } from "@/lib/time/timezone";

export interface AssignmentInput {
  title: string;
  course: string;
  dueAt: string;
  remainingMinutes: number;
  notes: string;
}

interface Draft {
  title: string;
  course: string;
  date: string;
  time: string;
  hours: string;
  minutes: string;
  notes: string;
}

const emptyDraft: Draft = {
  title: "", course: "", date: "", time: "", hours: "", minutes: "", notes: "",
};

export function AssignmentForm({ open, timezone, assignment, onSave, onClose }: {
  open: boolean; timezone: string; assignment?: Assignment;
  onSave: (input: AssignmentInput) => { ok: boolean; reason?: string };
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  const savingRef = useRef(false);
  const [draft, setDraft] = useState<Draft>(() => assignment
    ? {
        title: assignment.title,
        course: assignment.course,
        ...instantToLocalFields(assignment.dueAt, timezone),
        hours: String(Math.floor(assignment.remainingMinutes / 60)),
        minutes: String(assignment.remainingMinutes % 60),
        notes: assignment.notes,
      }
    : emptyDraft);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const initialDraft = useRef(JSON.stringify(draft));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      savingRef.current = false;
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
      // Native dialogs trap focus while open; return it to the control that opened the form.
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (JSON.stringify(draft) === initialDraft.current) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [open, draft]);

  function closePanel() {
    // Close before a saved edit can remount the keyed form, then restore its opener.
    if (dialogRef.current?.open) dialogRef.current.close();
    if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    onClose();
  }

  function change(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const title = draft.title.trim();
    const course = draft.course.trim();
    const notes = draft.notes.trim();
    const hours = Number(draft.hours || "0");
    const minutes = Number(draft.minutes || "0");
    const remainingMinutes = hours * 60 + minutes;
    const dueAt = localDateTimeToInstant(draft.date, draft.time, timezone);
    if (!title || title.length > 120 || course.length > 60 || notes.length > 2000) {
      setError("Check the text field limits and add a title.");
      return;
    }
    if (!dueAt) {
      setError("Choose a valid date and time. If the clock changes then, choose another time.");
      return;
    }
    if (!Number.isSafeInteger(hours) || !Number.isSafeInteger(minutes) ||
        hours < 0 || minutes < 0 || minutes > 59 || remainingMinutes < 1) {
      setError("Enter at least one minute of remaining work.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    // Yield once so the pending label is visible before the browser storage write.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      const result = onSave({ title, course, notes, dueAt, remainingMinutes });
      if (result.ok) {
        setError("");
        if (!assignment) {
          setDraft(emptyDraft);
          initialDraft.current = JSON.stringify(emptyDraft);
        }
        closePanel();
        setSaving(false);
      } else {
        setError(result.reason || "Could not save this assignment.");
        savingRef.current = false;
        setSaving(false);
      }
    } catch {
      setError("Could not save this assignment.");
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="assignment-dialog"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); if (!savingRef.current) closePanel(); }}
    >
      <form onSubmit={submit} className="assignment-form" aria-busy={saving}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Assignments</p>
            <h2 id={headingId}>{assignment ? "Edit assignment" : "Add assignment"}</h2>
          </div>
          <button type="button" className="text-button" disabled={saving} onClick={closePanel}>Close</button>
        </div>
        <p className="muted" id={descriptionId}>Enter the time you still need. Your deadline stays exactly as you set it.</p>
        <label>
          Title <span aria-hidden="true">*</span>
          <input autoFocus required maxLength={120} value={draft.title} onChange={(event) => change("title", event.target.value)} />
        </label>
        <label>
          Course <span className="optional">Optional</span>
          <input maxLength={60} value={draft.course} onChange={(event) => change("course", event.target.value)} />
        </label>
        <div className="form-grid">
          <label>
            Due date <span aria-hidden="true">*</span>
            <input required type="date" value={draft.date} onChange={(event) => change("date", event.target.value)} />
          </label>
          <label>
            Due time <span aria-hidden="true">*</span>
            <input required type="time" value={draft.time} onChange={(event) => change("time", event.target.value)} />
          </label>
        </div>
        <p className="field-help">Time zone: {timezone}. Past deadlines can be saved, but cannot receive sessions before that deadline.</p>
        <fieldset>
          <legend>Remaining work <span aria-hidden="true">*</span></legend>
          <div className="form-grid">
            <label>
              Hours
              <input required type="number" min="0" max="10000" step="1" value={draft.hours} onChange={(event) => change("hours", event.target.value)} />
            </label>
            <label>
              Minutes
              <input required type="number" min="0" max="59" step="1" value={draft.minutes} onChange={(event) => change("minutes", event.target.value)} />
            </label>
          </div>
        </fieldset>
        <label>
          Notes <span className="optional">Optional</span>
          <textarea maxLength={2000} rows={4} value={draft.notes} onChange={(event) => change("notes", event.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="action-row">
          <button className="button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save assignment"}</button>
          <button className="button button-secondary" type="button" disabled={saving} onClick={closePanel}>Keep draft and close</button>
        </div>
      </form>
    </dialog>
  );
}
