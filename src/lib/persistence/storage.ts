import type { AppState } from "@/lib/schema/types";
import { parseStoredDocument, type ParseResult } from "@/lib/schema/migrations";
import { detectedTimezone } from "@/lib/time/timezone";

export const STORAGE_KEY = "deadline-rescue:v1";
export type LoadResult = ParseResult | { kind: "empty" } | { kind: "unavailable" };

export function newAppState(): AppState {
  return {
    schemaVersion: 1, documentRevision: 0, inputRevision: 0, mode: "personal",
    timezone: detectedTimezone(), availabilityConfirmedAt: null,
    preferences: { sessionMinutes: 30 }, assignments: [], studyWindows: [],
    commitments: [], plan: null, activeFocus: null, workLogs: [],
  };
}

export function loadDocument(): LoadResult {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? { kind: "empty" } : parseStoredDocument(raw);
  } catch {
    return { kind: "unavailable" };
  }
}

export type SaveResult = "saved" | "unavailable" | "stale" | "blocked";

export function saveDocument(previous: AppState, next: AppState, memoryOnly: boolean): SaveResult {
  if (memoryOnly) return "unavailable";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const loaded = parseStoredDocument(raw);
      if (loaded.kind !== "ok") return "blocked";
      if (loaded.state.documentRevision !== previous.documentRevision) return "stale";
    } else if (previous.documentRevision !== 0) return "stale";
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return "saved";
  } catch {
    return "unavailable";
  }
}

export function discardStoredDocument(): boolean {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
