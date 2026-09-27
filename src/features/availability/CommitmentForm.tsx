"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Commitment } from "@/lib/schema/types";
import { instantToLocalFields } from "@/lib/time/timezone";
import type { CommitmentInput } from "./availability";

interface Draft {
  title: string;
  date: string;
  start: string;
  end: string;
  category: "" | NonNullable<Commitment["category"]>;
}

const blank: Draft = { title: "", date: "", start: "", end: "", category: "" };

export function CommitmentForm({ open, timezone, commitment, onClose, onSave }: {
  open: boolean;
  timezone: string;
  commitment?: Commitment;
  onClose: () => void;
  onSave: (input: CommitmentInput) => { ok: boolean; reason?: string };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savingRef = useRef(false);
  const closingRef = useRef(false);
  const [draft, setDraft] = useState<Draft>(() => commitment ? {
    title: commitment.title,
    date: instantToLocalFields(commitment.startAt, timezone).date,
    start: instantToLocalFields(commitment.startAt, timezone).time,
    end: instantToLocalFields(commitment.endAt, timezone).time,
    category: commitment.category || "",
  } : blank);
  const [error, setError] = useState("");
  const initialDraft = useRef(JSON.stringify(draft));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      closingRef.current = false;
      savingRef.current = false;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!window.history.state?.deadlineRescueCommitment) {
      window.history.pushState({ ...window.history.state, deadlineRescueCommitment: true }, "");
    }
    const onBack = () => onClose();
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || JSON.stringify(draft) === initialDraft.current) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [open, draft]);

  function closePanel() {
    if (closingRef.current) return;
    closingRef.current = true;
    if (window.history.state?.deadlineRescueCommitment) window.history.back();
    else onClose();
  }

  function change(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    const result = onSave({
      title: draft.title.trim(),
      date: draft.date,
      start: draft.start,
      end: draft.end,
      category: draft.category || null,
    });
    if (result.ok) {
      setError("");
      if (!commitment) {
        setDraft(blank);
        initialDraft.current = JSON.stringify(blank);
      }
      closePanel();
    } else {
      setError(result.reason || "Could not save this commitment.");
      savingRef.current = false;
    }
  }

  return (
    <dialog ref={dialogRef} className="assignment-dialog" onCancel={(event) => { event.preventDefault(); closePanel(); }}>
      <form className="assignment-form" onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Commitments</p>
            <h2>{commitment ? "Edit commitment" : "Add commitment"}</h2>
          </div>
          <button type="button" className="text-button" onClick={closePanel}>Close</button>
        </div>
        <p className="muted">Block class, work, or personal time that you cannot study.</p>
        <label>
          Title <span aria-hidden="true">*</span>
          <input autoFocus required maxLength={120} value={draft.title} onChange={(event) => change("title", event.target.value)} />
        </label>
        <label>
          Date <span aria-hidden="true">*</span>
          <input required type="date" value={draft.date} onChange={(event) => change("date", event.target.value)} />
        </label>
        <div className="form-grid">
          <label>
            Starts <span aria-hidden="true">*</span>
            <input required type="time" value={draft.start} onChange={(event) => change("start", event.target.value)} />
          </label>
          <label>
            Ends <span aria-hidden="true">*</span>
            <input required type="time" value={draft.end} onChange={(event) => change("end", event.target.value)} />
          </label>
        </div>
        <p className="field-help">Time zone: {timezone}. An end time before the start creates two entries across midnight.</p>
        <label>
          Category <span className="optional">Optional</span>
          <select value={draft.category} onChange={(event) => change("category", event.target.value)}>
            <option value="">None</option>
            <option value="class">Class</option>
            <option value="work">Work</option>
            <option value="personal">Personal</option>
          </select>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="action-row">
          <button className="button" type="submit">Save commitment</button>
          <button className="button button-secondary" type="button" onClick={closePanel}>Keep draft and close</button>
        </div>
      </form>
    </dialog>
  );
}
