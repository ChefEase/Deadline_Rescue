/** Persisted dates are UTC instants; only form controls use local date and time. */
export type Id = string;
export type Instant = string;
export type LocalTime = string;
export type LocalDate = string;
export type Minutes = number;

export interface Preferences {
  sessionMinutes: Minutes;
}

export interface AssignmentSource {
  excerpt: string;
  deadlineQuote: string | null;
  extractedDeadlineText: string | null;
  extractedDueAt: Instant | null;
  confirmedAt: Instant;
  editedByUser: boolean;
}

export interface Assignment {
  id: Id;
  title: string;
  course: string;
  dueAt: Instant;
  remainingMinutes: Minutes;
  status: "active" | "completed";
  notes: string;
  source: AssignmentSource | null;
  createdAt: Instant;
  updatedAt: Instant;
  completedAt: Instant | null;
}

export interface StudyWindow {
  id: Id;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  localStart: LocalTime;
  localEnd: LocalTime; // "24:00" means midnight at the end of this weekday.
  enabled: boolean;
}

export interface Commitment {
  id: Id;
  title: string;
  startAt: Instant;
  endAt: Instant;
  category: "class" | "work" | "personal" | null;
}

export interface StudyBlock {
  id: Id;
  assignmentId: Id;
  startAt: Instant;
  endAt: Instant;
  state: "scheduled" | "active" | "completed" | "missed";
}

export interface Shortfall {
  assignmentId: Id;
  requestedMinutes: Minutes;
  allocatedMinutes: Minutes;
  unscheduledMinutes: Minutes;
  reason: "insufficient_availability";
}

export interface Plan {
  generatedAt: Instant;
  inputRevision: number;
  horizonEndAt: Instant;
  blocks: StudyBlock[];
  shortfalls: Shortfall[];
  overdueAssignmentIds: Id[];
  outsideHorizonIds: Id[];
}

export interface ActiveFocus {
  id: Id;
  blockId: Id;
  assignmentId: Id;
  startedAt: Instant;
  lastResumedAt: Instant | null;
  accumulatedSeconds: number;
  state: "running" | "paused" | "review";
}

export interface WorkLog {
  id: Id;
  focusId: Id;
  assignmentId: Id;
  confirmedWorkedMinutes: Minutes;
  remainingBefore: Minutes;
  remainingAfter: Minutes;
  finishedAssignment: boolean;
  savedAt: Instant;
}

export interface AppState {
  schemaVersion: 1;
  documentRevision: number;
  inputRevision: number;
  mode: "personal" | "example";
  timezone: string;
  availabilityConfirmedAt: Instant | null;
  preferences: Preferences;
  assignments: Assignment[];
  studyWindows: StudyWindow[];
  commitments: Commitment[];
  plan: Plan | null;
  activeFocus: ActiveFocus | null;
  workLogs: WorkLog[];
}
