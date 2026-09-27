import type { AppState } from "./types";
import { isAppState } from "./validate";

export type ParseResult = { kind: "ok"; state: AppState } | { kind: "invalid" | "unsupported" };

/** Future schema versions need an explicit migration, never an implicit reset. */
export function parseStoredDocument(raw: string): ParseResult {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("schemaVersion" in value)) return { kind: "invalid" };
    if (value.schemaVersion !== 1) return { kind: "unsupported" };
    return isAppState(value) ? { kind: "ok", state: value } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}
