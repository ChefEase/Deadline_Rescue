"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SetupChecklist } from "@/components/SetupChecklist";
import { formatDue, formatEffort } from "@/features/assignments/AssignmentList";
import type { AppState, Assignment, Commitment, StudyBlock } from "@/lib/schema/types";
import { isAppState } from "@/lib/schema/validate";
import { summarizePlanChanges, type AssignmentPlanChange } from "@/lib/scheduling/changes";
import { localDayStart, SchedulingError } from "@/lib/scheduling/scheduler";
import { addLocalDays, instantToLocalFields } from "@/lib/time/timezone";
import { useAppStore } from "@/store/app-store";
import { buildPlanForState } from "./build-plan";
import { PlanChanges } from "./PlanChanges";

const DATE_KEY = "deadline-rescue:plan-date";

type PlanEvent =
  | { kind: "session"; startAt: string; endAt: string; block: StudyBlock; assignment: Assignment }
  | { kind: "commitment"; startAt: string; endAt: string; commitment: Commitment };

function formatClock(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(instant));
}

function formatDay(date: string, options: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`));
}

function eventsForDate(state: AppState, date: string): PlanEvent[] {
  // Use local day boundaries so sessions and commitments crossing midnight appear on both days.
  const dayStart = localDayStart(date, state.timezone);
  const nextDayStart = localDayStart(addLocalDays(date, 1), state.timezone);
  const overlapsDay = (startAt: string, endAt: string) => startAt < nextDayStart && endAt > dayStart;
  const assignments = new Map(state.assignments.map((assignment) => [assignment.id, assignment]));
  const sessions: PlanEvent[] = (state.plan?.blocks ?? []).flatMap((block) => {
    const assignment = assignments.get(block.assignmentId);
    return assignment && overlapsDay(block.startAt, block.endAt)
      ? [{ kind: "session" as const, startAt: block.startAt, endAt: block.endAt, block, assignment }]
      : [];
  });
  const commitments: PlanEvent[] = state.commitments
    .filter((commitment) => overlapsDay(commitment.startAt, commitment.endAt))
    .map((commitment) => ({ kind: "commitment", startAt: commitment.startAt, endAt: commitment.endAt, commitment }));
  return [...sessions, ...commitments].sort((a, b) => a.startAt.localeCompare(b.startAt) || a.kind.localeCompare(b.kind));
}

function sessionMinutes(block: StudyBlock): number {
  return (Date.parse(block.endAt) - Date.parse(block.startAt)) / 60_000;
}

function EventRow({ event, timezone, now, stale, compact = false }: { event: PlanEvent; timezone: string; now: string; stale: boolean; compact?: boolean }) {
  const time = `${formatClock(event.startAt, timezone)}–${formatClock(event.endAt, timezone)}`;
  if (event.kind === "commitment") {
    return <div className={`plan-event commitment-event${compact ? " compact" : ""}`}>
      <span className="event-type">Commitment</span>
      <strong>{event.commitment.title}</strong>
      <span>{time}</span>
    </div>;
  }
  // A passed, unconfirmed block is shown as missed even before Replan stores that state.
  const sessionLabel = event.block.state === "scheduled"
    ? event.block.endAt <= now ? "Missed session" : stale ? "Saved session · needs update" : "Study session"
    : `${event.block.state} session`;
  const needsReview = event.block.state === "missed" ||
    (event.block.state === "scheduled" && (stale || event.block.endAt <= now));
  return <Link href={`/assignments/${event.assignment.id}`} className={`plan-event study-event${needsReview ? " attention-event" : ""}${compact ? " compact" : ""}`}>
    <span className="event-type">{sessionLabel}</span>
    <strong>{event.assignment.title}</strong>
    <span>{time} · {formatEffort(sessionMinutes(event.block))}</span>
  </Link>;
}

function NextUpCard({ state, now, stale }: { state: AppState; now: string; stale: boolean }) {
  if (stale) {
    return <section className="next-up-card">
      <p className="eyebrow">What to do next</p>
      <h2>Refresh your plan</h2>
      <p className="next-up-explanation">Saved sessions may no longer fit. Use Replan above before following the schedule.</p>
    </section>;
  }
  const next = state.plan?.blocks
    .filter((block) => block.state === "scheduled" && block.endAt > now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  const assignment = next && state.assignments.find((item) => item.id === next.assignmentId);
  if (!next || !assignment) {
    const shortfall = state.plan?.shortfalls[0];
    const affected = state.assignments.find((item) => item.status === "active" && item.dueAt <= now)
      ?? state.assignments.find((item) => item.id === shortfall?.assignmentId);
    const deadlinePassed = Boolean(affected && affected.dueAt <= now);
    const heading = affected
      ? deadlinePassed ? `Review ${affected.title}` : `Make time for ${affected.title}`
      : "No study session is scheduled";
    let explanation = "There are no study sessions in this 14-day plan. Later assignments will be planned when they enter this range.";
    if (affected && deadlinePassed) {
      explanation = `The deadline passed with ${formatEffort(affected.remainingMinutes)} of work still listed. Review the assignment to update its deadline or mark it complete.`;
    } else if (affected) {
      explanation = `No confirmed study time fits before its ${formatDue(affected.dueAt, state.timezone)} deadline. Check your study hours or the deadline.`;
    }

    return (
      <section className="next-up-card">
        <p className="eyebrow">What to do next</p>
        <h2>{heading}</h2>
        <p className="next-up-explanation">{explanation}</p>
        {affected && <Link className="button" href={deadlinePassed ? `/assignments/${affected.id}` : "/availability"}>
          {deadlinePassed ? "Review assignment" : "Review study hours"}
        </Link>}
        {affected && !deadlinePassed && <Link className="next-up-secondary-link" href={`/assignments/${affected.id}`}>
          Review assignment deadline
        </Link>}
      </section>
    );
  }

  return <section className="next-up-card">
    <p className="eyebrow">Next up</p>
    <p className="next-up-when">{next.startAt <= now ? "Available now" : `Next at ${formatClock(next.startAt, state.timezone)}`}</p>
    <h2>{assignment.title}</h2>
    {assignment.course && <p className="next-up-course">{assignment.course}</p>}
    <dl className="next-up-facts">
      <div><dt>Study session</dt><dd>{formatDue(next.startAt, state.timezone)}–{formatClock(next.endAt, state.timezone)}</dd></div>
      <div><dt>Planned time</dt><dd>{formatEffort(sessionMinutes(next))}</dd></div>
      <div><dt>Deadline</dt><dd>{formatDue(assignment.dueAt, state.timezone)}</dd></div>
    </dl>
    <Link className="button" href={`/assignments/${assignment.id}`}>View assignment</Link>
  </section>;
}

function Agenda({ state, date, now, stale }: { state: AppState; date: string; now: string; stale: boolean }) {
  const events = eventsForDate(state, date);
  return <section className="agenda-view" aria-labelledby="agenda-heading">
    <div className="section-heading"><div><p className="eyebrow">Daily agenda</p><h2 id="agenda-heading">{formatDay(date)}</h2></div></div>
    {events.length === 0 ? <p className="agenda-empty">No study sessions or commitments on this day.</p> : <div className="agenda-events">{events.map((event) => <EventRow key={`${event.kind}:${event.kind === "session" ? event.block.id : event.commitment.id}`} event={event} timezone={state.timezone} now={now} stale={stale} />)}</div>}
  </section>;
}

function WeekCalendar({ state, date, lastDate, needsAttention, now, stale }: { state: AppState; date: string; lastDate: string; needsAttention: boolean; now: string; stale: boolean }) {
  // A rolling week keeps the selected day in view, including when it is Sunday.
  const days = Array.from({ length: 7 }, (_, index) => addLocalDays(date, index))
    .filter((day) => day <= lastDate)
    .map((day) => ({ date: day, events: eventsForDate(state, day) }));
  const hasEvents = days.some((day) => day.events.length > 0);
  const endDate = days[days.length - 1].date;
  return <section className="week-calendar" aria-labelledby="calendar-heading">
    <div className="section-heading"><div><p className="eyebrow">Calendar</p><h2 id="calendar-heading">{date === endDate
      ? formatDay(date, { month: "short", day: "numeric", year: "numeric" })
      : `${formatDay(date, { month: "short", day: "numeric" })} to ${formatDay(endDate, { month: "short", day: "numeric", year: "numeric" })}`}</h2></div></div>
    {!hasEvents && <p className="calendar-empty-state">No study sessions or commitments are scheduled in these days. {needsAttention
      ? "See the work needing attention below for the reason."
      : "Choose another day to see sessions elsewhere in the plan."}</p>}
    {hasEvents && <div className="calendar-grid">{days.map((day) => {
      return <div className="calendar-day" key={day.date} data-selected={day.date === date}>
        <h3>{formatDay(day.date, { weekday: "short", month: "short", day: "numeric" })}</h3>
        {day.events.length === 0 ? <p className="calendar-empty">Nothing scheduled</p> : day.events.map((event) => <EventRow key={`${event.kind}:${event.kind === "session" ? event.block.id : event.commitment.id}`} event={event} timezone={state.timezone} now={now} stale={stale} compact />)}
      </div>;
    })}</div>}
  </section>;
}

function AttentionList({ state, now }: { state: AppState; now: string }) {
  const plan = state.plan;
  if (!plan) return null;
  const assignments = new Map(state.assignments.map((item) => [item.id, item]));
  const hasScheduledTime = plan.blocks.some((block) => block.state === "scheduled" && block.endAt > now);
  const shortfallIds = new Set(plan.shortfalls.map((shortfall) => shortfall.assignmentId));
  const overdueIds = state.assignments
    .filter((assignment) => assignment.status === "active" && assignment.dueAt <= now && !shortfallIds.has(assignment.id))
    .map((assignment) => assignment.id);
  const allShortfallsOverdue = plan.shortfalls.every((shortfall) => (assignments.get(shortfall.assignmentId)?.dueAt ?? "") <= now);
  return <div className="plan-attention">
    {plan.shortfalls.length > 0 && <section className="attention-section" aria-labelledby="shortfall-heading">
      <h2 id="shortfall-heading">Work without enough study time</h2>
      <p>{allShortfallsOverdue
        ? "These deadlines have passed. Review the assignments to update their deadlines or mark finished work complete."
        : hasScheduledTime
          ? "Some work still needs time before its deadline. The sessions shown above remain in your plan."
          : "No future study sessions could be placed before these deadlines. Review your study hours or the deadlines."}</p>
      <ul>{plan.shortfalls.map((shortfall) => {
        const assignment = assignments.get(shortfall.assignmentId);
        if (!assignment) return null;
        const deadlinePassed = assignment.dueAt <= now;
        return <li key={assignment.id}>
          <strong>{assignment.title}</strong>
          <span>Deadline: {formatDue(assignment.dueAt, state.timezone)}</span>
          <span>Work left: {formatEffort(assignment.remainingMinutes)}</span>
          <span>Study time planned: {shortfall.allocatedMinutes ? formatEffort(shortfall.allocatedMinutes) : "None"}</span>
          <span className="shortfall-value">{deadlinePassed
            ? "Deadline passed. Review the assignment."
            : shortfall.allocatedMinutes === 0
              ? "No study time fits before the deadline."
              : `${formatEffort(shortfall.unscheduledMinutes)} still needs study time before the deadline.`}</span>
          <Link href={`/assignments/${assignment.id}`}>Review assignment</Link>
        </li>;
      })}</ul>
    </section>}
    {overdueIds.length > 0 && <section className="attention-section" aria-labelledby="overdue-heading">
      <h2 id="overdue-heading">Overdue work</h2>
      <p>These deadlines have passed. Review each assignment to update its deadline or mark it complete.</p>
      <ul>{overdueIds.map((id) => {
        const assignment = assignments.get(id);
        return assignment && <li key={id}><strong>{assignment.title}</strong><span>Deadline: {formatDue(assignment.dueAt, state.timezone)}</span><span>Work left: {formatEffort(assignment.remainingMinutes)}</span><Link href={`/assignments/${id}`}>Review assignment</Link></li>;
      })}</ul>
    </section>}
    {plan.outsideHorizonIds.length > 0 && <section className="attention-section quiet" aria-labelledby="later-heading">
      <h2 id="later-heading">Beyond the 14-day plan</h2>
      <p>These assignments are outside the current planning range and are not included in the fit assessment.</p>
      <ul>{plan.outsideHorizonIds.map((id) => {
        const assignment = assignments.get(id);
        return assignment && <li key={id}><strong>{assignment.title}</strong><span>Due {formatDue(assignment.dueAt, state.timezone)}</span><Link href={`/assignments/${id}`}>View assignment</Link></li>;
      })}</ul>
    </section>}
  </div>;
}

function readSavedDate(): string {
  try { return window.sessionStorage.getItem(DATE_KEY) || ""; }
  catch { return ""; }
}

export function PlanView() {
  const { state, mutate } = useAppStore();
  const [now, setNow] = useState(() => new Date().toISOString());
  const [requestedDate, setRequestedDate] = useState(readSavedDate);
  const [error, setError] = useState("");
  const [planChanges, setPlanChanges] = useState<AssignmentPlanChange[] | null>(null);
  const [building, setBuilding] = useState(false);
  const buildingRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!state) return null;

  const activeCount = state.assignments.filter((assignment) => assignment.status === "active").length;
  const confirmed = Boolean(state.availabilityConfirmedAt && state.studyWindows.some((window) => window.enabled));
  const plan = state.plan;
  const expired = Boolean(plan && plan.blocks.some((block) => block.state === "scheduled" && block.endAt <= now));
  const stale = Boolean(plan && (plan.inputRevision !== state.inputRevision || expired || plan.horizonEndAt <= now));
  const pastDueAssignments = state.assignments.filter((assignment) => assignment.status === "active" && assignment.dueAt <= now);
  const needsAttention = Boolean(plan && (plan.shortfalls.length || pastDueAssignments.length));
  const hasOutside = Boolean(plan?.outsideHorizonIds.length);
  const today = instantToLocalFields(now, state.timezone).date;
  const firstDate = plan ? instantToLocalFields(plan.generatedAt, state.timezone).date : today;
  const lastDate = plan ? addLocalDays(instantToLocalFields(plan.horizonEndAt, state.timezone).date, -1) : today;
  const selectedDate = requestedDate >= firstDate && requestedDate <= lastDate
    ? requestedDate : today >= firstDate && today <= lastDate ? today : firstDate;

  function selectDate(date: string) {
    if (date < firstDate || date > lastDate) return;
    setRequestedDate(date);
    try { window.sessionStorage.setItem(DATE_KEY, date); } catch { /* Date selection still works in memory. */ }
  }

  function buildPlan() {
    if (buildingRef.current) return;
    buildingRef.current = true;
    setBuilding(true);
    setError("");
    try {
      const referenceNow = new Date().toISOString();
      const generated = buildPlanForState(state!, referenceNow);
      // Check the entire replacement document before the store attempts one atomic save.
      if (!isAppState({ ...state!, plan: generated })) throw new Error("The new plan did not pass validation. Your saved plan was not changed.");
      const changes = plan ? summarizePlanChanges(plan, generated, state!.assignments, referenceNow) : null;
      const result = mutate((current) => ({ ...current, plan: generated }));
      if (result.ok) {
        setPlanChanges(changes);
        setNow(referenceNow);
        setRequestedDate("");
        try { window.sessionStorage.removeItem(DATE_KEY); } catch { /* The calendar still resets in memory. */ }
      } else setError(result.reason);
    } catch (cause) {
      setError(cause instanceof SchedulingError && cause.code === "active_focus_conflict"
        ? "A commitment overlaps the Focus session in progress. Edit that commitment or finish Focus before replanning. Your saved plan is unchanged."
        : cause instanceof Error ? cause.message : "The plan could not be built.");
    } finally {
      buildingRef.current = false;
      setBuilding(false);
    }
  }

  let statusTitle: string;
  let statusText: string;
  if (!activeCount) {
    statusTitle = "No work remaining";
    statusText = "You're all caught up. Add an assignment whenever new work arrives.";
  } else if (!confirmed || !plan) {
    statusTitle = "Setup needed";
    statusText = confirmed ? "Your study hours are ready. Build a plan to see what fits." : "Confirm your study hours before building a plan.";
  } else if (stale) {
    statusTitle = "Needs update";
    statusText = expired
      ? "A study session passed without a confirmed review. Replan to mark it missed and find new time."
      : plan?.inputRevision !== state.inputRevision
        ? "Your assignments or available hours changed. Replan before using saved study sessions."
        : "This plan's 14-day range ended. Replan to see upcoming study time.";
  } else if (pastDueAssignments.length > 0) {
    statusTitle = pastDueAssignments.length === 1 ? "A deadline has passed" : `${pastDueAssignments.length} deadlines have passed`;
    statusText = pastDueAssignments.length === 1
      ? `${pastDueAssignments[0].title} was due ${formatDue(pastDueAssignments[0].dueAt, state.timezone)} and still has ${formatEffort(pastDueAssignments[0].remainingMinutes)} listed. Review it to update the deadline or mark it complete.`
      : "Review the overdue work below. You can update a deadline or mark finished work complete.";
  } else if (needsAttention) {
    const noTime = plan?.shortfalls.every((shortfall) => shortfall.allocatedMinutes === 0);
    const onlyShortfall = plan?.shortfalls.length === 1
      ? state.assignments.find((assignment) => assignment.id === plan.shortfalls[0].assignmentId)
      : undefined;
    statusTitle = noTime
      ? plan?.shortfalls.length === 1 ? "No study time before the deadline" : "No study time before these deadlines"
      : "Some work needs more time";
    statusText = noTime && onlyShortfall
      ? `${onlyShortfall.title} has ${formatEffort(onlyShortfall.remainingMinutes)} left, but no confirmed study time fits before its ${formatDue(onlyShortfall.dueAt, state.timezone)} deadline. Review your hours or the deadline.`
      : noTime
        ? "Your confirmed study hours leave no time for the work listed below before it is due. Review your hours or the deadline."
      : "Some work does not fit before its deadline. See exactly how much time is missing below.";
  } else if (hasOutside) {
    statusTitle = "Next 14 days planned";
    statusText = "Work inside this planning range fits. Later assignments have not been assessed yet.";
  } else {
    statusTitle = "All work fits";
    statusText = "Your active work fits in the confirmed study time before its deadlines.";
  }

  return <div className="plan-page">
    <header className="page-heading">
      <div><p className="eyebrow">My Plan</p><h1>Your study plan</h1><p>Times shown in {state.timezone.replaceAll("_", " ")}</p></div>
      <Link className="button button-secondary" href="/assignments">Add assignment</Link>
    </header>
    {state.mode === "example" && <p className="availability-notice">Example data</p>}
    <section className="plan-status" data-tone={stale || needsAttention ? "attention" : "calm"} aria-live="polite">
      <div><p className="eyebrow">What your plan found</p><h2>{statusTitle}</h2><p>{statusText}</p></div>
      {activeCount > 0 && confirmed && (!plan || stale) && <button className="button" disabled={building} onClick={buildPlan}>{building ? "Building…" : plan ? "Replan" : "Build my plan"}</button>}
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {planChanges && <PlanChanges changes={planChanges} onDismiss={() => setPlanChanges(null)} />}

    {!activeCount ? <section className="plan-empty"><h2>You&apos;re all caught up</h2><p>Add an assignment to see your next useful study session.</p><Link className="button" href="/assignments">Add assignment</Link></section>
      : !confirmed || !plan ? <div className="plan-setup"><SetupChecklist state={state} />{confirmed && <p>Your confirmed hours are ready. Select <strong>Build my plan</strong> above to generate sessions.</p>}</div>
      : <>
        <div className="plan-main-grid">
          <div className="plan-primary">
            <NextUpCard state={state} now={now} stale={stale} />
            <div className="date-controls">
              <button aria-label="Previous day" disabled={selectedDate <= firstDate} onClick={() => selectDate(addLocalDays(selectedDate, -1))}>←</button>
              <label>Day to view <input type="date" min={firstDate} max={lastDate} value={selectedDate} onChange={(event) => selectDate(event.target.value)} /></label>
              <button aria-label="Next day" disabled={selectedDate >= lastDate} onClick={() => selectDate(addLocalDays(selectedDate, 1))}>→</button>
            </div>
            <Agenda state={state} date={selectedDate} now={now} stale={stale} />
          </div>
          <WeekCalendar state={state} date={selectedDate} lastDate={lastDate} needsAttention={needsAttention} now={now} stale={stale} />
        </div>
        <AttentionList state={state} now={now} />
        <p className="plan-range">This plan covers {formatDay(firstDate, { month: "short", day: "numeric" })} to {formatDay(lastDate, { month: "short", day: "numeric", year: "numeric" })}. Study sessions are estimates based on your confirmed hours.</p>
      </>}
  </div>;
}
