import { formatEffort } from "@/features/assignments/AssignmentList";
import type { AssignmentPlanChange } from "@/lib/scheduling/changes";

function sessionText(count: number, action: string): string {
  return `${count} study ${count === 1 ? "session" : "sessions"} ${action}`;
}

export function PlanChanges({ changes, onDismiss }: { changes: AssignmentPlanChange[]; onDismiss: () => void }) {
  return <section className="plan-changes" aria-labelledby="plan-changes-heading" role="status">
    <div className="section-heading">
      <div><p className="eyebrow">Replan complete</p><h2 id="plan-changes-heading">What changed</h2></div>
      <button className="text-button" onClick={onDismiss}>Dismiss</button>
    </div>
    {changes.length === 0
      ? <p>Your future study sessions stayed the same.</p>
      : <ul>{changes.map((change) => <li key={change.assignmentId}>
        <strong>{change.title}</strong>
        <ul>
          {change.movedSessions > 0 && <li>{sessionText(change.movedSessions, "moved to another time")}</li>}
          {change.addedSessions > 0 && <li>{sessionText(change.addedSessions, "added")}</li>}
          {change.removedSessions > 0 && <li>{sessionText(change.removedSessions, "removed")}</li>}
          {change.missedSessions > 0 && <li>{sessionText(change.missedSessions, "missed, with work still remaining")}</li>}
          {change.unscheduledAfter > change.unscheduledBefore && <li>{formatEffort(change.unscheduledAfter - change.unscheduledBefore)} more could not fit before the deadline.</li>}
          {change.unscheduledAfter < change.unscheduledBefore && <li>{formatEffort(change.unscheduledBefore - change.unscheduledAfter)} now fits before the deadline.</li>}
          {change.unscheduledAfter > 0 && <li><strong>{formatEffort(change.unscheduledAfter)} still has no study time before the deadline.</strong></li>}
        </ul>
      </li>)}</ul>}
    <p className="plan-changes-note">Deadlines and remaining-work estimates stayed as you entered them.</p>
  </section>;
}
