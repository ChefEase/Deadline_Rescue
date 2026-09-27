import Link from "next/link";
import type { AppState } from "@/lib/schema/types";

export function SetupChecklist({ state }: { state: AppState }) {
  const hasWork = state.assignments.some((assignment) => assignment.status === "active");
  const hasAvailability = Boolean(state.availabilityConfirmedAt && state.studyWindows.some((window) => window.enabled));
  const hasPlan = Boolean(state.plan && state.plan.inputRevision === state.inputRevision);

  return (
    <section className="setup-checklist" aria-labelledby="setup-heading">
      <div>
        <p className="eyebrow">Getting started</p>
        <h2 id="setup-heading">Your path to a plan</h2>
      </div>
      <ol>
        <li data-done={hasWork}><span>{hasWork ? "Done" : "1"}</span><div><strong>Add an assignment</strong><p>Include its deadline and remaining work.</p></div><Link href="/assignments">{hasWork ? "Review" : "Add work"}</Link></li>
        <li data-done={hasAvailability}><span>{hasAvailability ? "Done" : "2"}</span><div><strong>Confirm study hours</strong><p>Review the suggested windows and commitments.</p></div><Link href="/availability">{hasAvailability ? "Review" : "Set availability"}</Link></li>
        <li data-done={hasPlan}><span>{hasPlan ? "Done" : "3"}</span><div><strong>Build your plan</strong><p>See what fits before each deadline.</p></div><Link href="/plan">{hasPlan ? "View plan" : "Go to Plan"}</Link></li>
      </ol>
    </section>
  );
}
