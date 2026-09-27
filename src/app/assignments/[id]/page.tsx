"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { StoreBoundary } from "@/components/StoreBoundary";
import { AssignmentForm, type AssignmentInput } from "@/features/assignments/AssignmentForm";
import { formatDue, formatEffort } from "@/features/assignments/AssignmentList";
import { useAppStore, removeFutureBlocks } from "@/store/app-store";

function AssignmentDetails() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, mutate } = useAppStore();
  const [editOpen, setEditOpen] = useState(false);
  const [reopenMinutes, setReopenMinutes] = useState("");
  const [error, setError] = useState("");
  if (!state) return null;
  const assignment = state.assignments.find((item) => item.id === id);
  if (!assignment) {
    return (
      <section className="page-card">
        <h1>Assignment not found</h1>
        <p>This link does not match saved work in this browser.</p>
        <Link className="button" href="/assignments">Back to assignments</Link>
      </section>
    );
  }
  const focusOnAssignment = state.activeFocus?.assignmentId === id;

  function edit(input: AssignmentInput) {
    // Keep the old sessions as a stale snapshot so Replan can explain what moved.
    const result = mutate((current) => ({
      ...current,
      assignments: current.assignments.map((item) => item.id === id ? {
        ...item,
        ...input,
        updatedAt: new Date().toISOString(),
        source: item.source ? {
          ...item.source,
          editedByUser: item.source.editedByUser || item.source.extractedDueAt !== input.dueAt,
        } : null,
      } : item),
    }));
    if (!result.ok) setError(result.reason);
    return result;
  }

  function complete() {
    if (!assignment) return;
    if (focusOnAssignment) {
      setError("Review the active Focus session before completing this assignment.");
      return;
    }
    if (!window.confirm(`Mark “${assignment.title}” complete? Remaining work will become zero and unstarted sessions will be removed.`)) return;
    const now = new Date().toISOString();
    const result = mutate((current) => removeFutureBlocks({
      ...current,
      assignments: current.assignments.map((item) => item.id === id ? {
        ...item, status: "completed", remainingMinutes: 0, completedAt: now, updatedAt: now,
      } : item),
    }, id));
    if (!result.ok) setError(result.reason);
  }

  function reopen() {
    const minutes = Number(reopenMinutes);
    if (!Number.isSafeInteger(minutes) || minutes < 1) {
      setError("Enter a positive number of minutes to reopen this assignment.");
      return;
    }
    const result = mutate((current) => ({
      ...current,
      assignments: current.assignments.map((item) => item.id === id ? {
        ...item, status: "active", remainingMinutes: minutes, completedAt: null,
        updatedAt: new Date().toISOString(),
      } : item),
    }));
    setError(result.ok ? "" : result.reason);
  }

  function remove() {
    if (!assignment) return;
    if (focusOnAssignment) {
      setError("Review the active Focus session before deleting this assignment.");
      return;
    }
    if (!window.confirm(`Delete “${assignment.title}” and its work history? This cannot be undone.`)) return;
    // Delete related records in the same document write to preserve references.
    const result = mutate((current) => ({
      ...current,
      assignments: current.assignments.filter((item) => item.id !== id),
      workLogs: current.workLogs.filter((log) => log.assignmentId !== id),
      plan: current.plan ? {
        ...current.plan,
        blocks: current.plan.blocks.filter((block) => block.assignmentId !== id),
        shortfalls: current.plan.shortfalls.filter((shortfall) => shortfall.assignmentId !== id),
        overdueAssignmentIds: current.plan.overdueAssignmentIds.filter((item) => item !== id),
        outsideHorizonIds: current.plan.outsideHorizonIds.filter((item) => item !== id),
      } : null,
    }));
    if (!result.ok) setError(result.reason);
    else router.push("/assignments");
  }

  return (
    <div className="detail-page">
      <Link className="back-link" href="/assignments">← Back to assignments</Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Assignment details</p>
          <h1>{assignment.title}</h1>
          <p>{assignment.course || "No course specified"}</p>
        </div>
        <span className="status-label">{assignment.status === "completed" ? "Completed" : "Active"}</span>
      </div>
      <div className="detail-grid">
        <section className="detail-section">
          <h2>What’s left</h2>
          <dl>
            <div>
              <dt>Deadline</dt>
              <dd>
                {formatDue(assignment.dueAt, state.timezone)}
                {assignment.source?.editedByUser && <span className="edited-label">Edited by you</span>}
              </dd>
            </div>
            <div>
              <dt>Remaining work</dt>
              <dd>{assignment.status === "completed" ? "Complete" : formatEffort(assignment.remainingMinutes)}</dd>
            </div>
            <div>
              <dt>Scheduling</dt>
              <dd>{!state.plan ? "Not planned yet" : state.plan.inputRevision === state.inputRevision
                ? "See My Plan for scheduled sessions and shortfalls."
                : "Needs update. Replan after availability is set."}</dd>
            </div>
          </dl>
        </section>
        <section className="detail-section">
          <h2>Notes and source</h2>
          <p>{assignment.notes || "No notes added."}</p>
          {assignment.source && (
            <>
              <p className="source-label">Original excerpt</p>
              <blockquote>{assignment.source.excerpt}</blockquote>
              {assignment.source.deadlineQuote && <p><strong>Deadline quote:</strong> {assignment.source.deadlineQuote}</p>}
            </>
          )}
        </section>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="action-row">
        {assignment.status === "active" ? (
          <>
            <button className="button" onClick={() => setEditOpen(true)}>Edit details</button>
            <button className="button button-secondary" onClick={complete}>Mark complete</button>
          </>
        ) : (
          <div className="reopen-group">
            <label>
              Minutes remaining to reopen
              <input type="number" min="1" step="1" value={reopenMinutes} onChange={(event) => setReopenMinutes(event.target.value)} />
            </label>
            <button className="button button-secondary" onClick={reopen}>Reopen</button>
          </div>
        )}
        <button className="button button-danger" onClick={remove}>Delete assignment</button>
      </div>
      {assignment.status === "active" && (
        <AssignmentForm
          key={`${assignment.id}:${assignment.updatedAt}`}
          open={editOpen}
          timezone={state.timezone}
          assignment={assignment}
          onClose={() => setEditOpen(false)}
          onSave={edit}
        />
      )}
    </div>
  );
}

export default function AssignmentDetailsPage() {
  return <StoreBoundary><AssignmentDetails /></StoreBoundary>;
}
