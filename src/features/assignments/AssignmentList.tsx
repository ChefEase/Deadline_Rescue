import Link from "next/link";
import { useState } from "react";
import type { Assignment, Plan } from "@/lib/schema/types";
import { sortedAssignments } from "@/store/app-store";

export function formatDue(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(instant));
}

export function formatEffort(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours && remainder ? `${hours}h ${remainder}m` : hours ? `${hours}h` : `${remainder}m`;
}

function scheduleStatus(assignment: Assignment, plan: Plan | null, inputRevision: number, asOf: number) {
  if (assignment.status === "completed") return { text: "Completed", tone: "calm", icon: "✓" };
  if (new Date(assignment.dueAt).getTime() < asOf) return { text: "Overdue · needs a new deadline", tone: "attention", icon: "!" };
  if (!plan) return { text: "Not planned yet", tone: "neutral", icon: "→" };
  if (plan.inputRevision !== inputRevision) return { text: "Needs update", tone: "attention", icon: "!" };
  const shortfall = plan.shortfalls.find((item) => item.assignmentId === assignment.id);
  if (shortfall) return { text: `Shortfall: ${formatEffort(shortfall.unscheduledMinutes)}`, tone: "attention", icon: "!" };
  if (plan.outsideHorizonIds.includes(assignment.id)) return { text: "Outside planning range", tone: "neutral", icon: "→" };
  const scheduled = plan.blocks.some((block) => block.assignmentId === assignment.id && block.state === "scheduled");
  return { text: scheduled ? "Scheduled" : "Not scheduled", tone: scheduled ? "calm" : "neutral", icon: scheduled ? "✓" : "→" };
}

export function AssignmentList({ assignments, timezone, status, plan, inputRevision }: {
  assignments: Assignment[]; timezone: string; status: Assignment["status"];
  plan: Plan | null; inputRevision: number;
}) {
  const sorted = sortedAssignments(assignments, status);
  const [asOf] = useState(() => Date.now());
  if (sorted.length === 0) {
    return (
      <div className="empty-state">
        <h2>{status === "active" ? "No assignments yet" : "Nothing completed yet"}</h2>
        <p>{status === "active"
          ? "Add an assignment manually or paste instructions above to find deadlines."
          : "Completed work will appear here."}</p>
      </div>
    );
  }

  return (
    <ul className="assignment-list">
      {sorted.map((assignment) => {
        const scheduling = scheduleStatus(assignment, plan, inputRevision, asOf);
        return (
          <li key={assignment.id}>
            <Link href={`/assignments/${assignment.id}`} className="assignment-row">
              <div>
                <span className="assignment-title">{assignment.title}</span>
                <span className="assignment-course">{assignment.course || "No course"}</span>
              </div>
              <div className="assignment-meta">
                <span><strong>Due</strong> {formatDue(assignment.dueAt, timezone)}</span>
                <span><strong>Remaining</strong> {status === "completed" ? "Complete" : formatEffort(assignment.remainingMinutes)}</span>
                <span className="status-label" data-tone={scheduling.tone}><span aria-hidden="true">{scheduling.icon}</span>{scheduling.text}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
