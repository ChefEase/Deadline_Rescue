"use client";

import { useState } from "react";
import { StoreBoundary } from "@/components/StoreBoundary";
import { SetupChecklist } from "@/components/SetupChecklist";
import { AssignmentForm, type AssignmentInput } from "@/features/assignments/AssignmentForm";
import { AssignmentList } from "@/features/assignments/AssignmentList";
import { useAppStore } from "@/store/app-store";

function AssignmentsContent() {
  const { state, mutate } = useAppStore();
  const [filter, setFilter] = useState<"active" | "completed">("active");
  const [formOpen, setFormOpen] = useState(false);
  if (!state) return null;

  function save(input: AssignmentInput) {
    const now = new Date().toISOString();
    return mutate((current) => ({
      ...current,
      assignments: [...current.assignments, {
        id: crypto.randomUUID(),
        ...input,
        status: "active",
        source: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      }],
    }));
  }

  return (
    <div className="assignments-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Assignments</p>
          <h1>Capture your work.</h1>
          <p>Add each deadline and the time you still need. You can adjust both later.</p>
        </div>
        <button className="button" onClick={() => setFormOpen(true)}>Add assignment</button>
      </header>
      {!state.plan && <SetupChecklist state={state} />}
      <div className="assignment-toolbar" role="group" aria-label="Assignment status">
        <button aria-pressed={filter === "active"} onClick={() => setFilter("active")}>Active <span>{state.assignments.filter((assignment) => assignment.status === "active").length}</span></button>
        <button aria-pressed={filter === "completed"} onClick={() => setFilter("completed")}>Completed <span>{state.assignments.filter((assignment) => assignment.status === "completed").length}</span></button>
      </div>
      <AssignmentList assignments={state.assignments} timezone={state.timezone} status={filter} plan={state.plan} inputRevision={state.inputRevision} />
      <AssignmentForm open={formOpen} timezone={state.timezone} onClose={() => setFormOpen(false)} onSave={save} />
    </div>
  );
}

export default function AssignmentsPage() {
  return <StoreBoundary><AssignmentsContent /></StoreBoundary>;
}
