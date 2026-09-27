"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppState, Assignment } from "@/lib/schema/types";
import { STORAGE_KEY, discardStoredDocument, loadDocument, newAppState, saveDocument } from "@/lib/persistence/storage";
import { isAppState } from "@/lib/schema/validate";

type StoreStatus = "loading" | "ready" | "invalid" | "unsupported" | "stale";
type MutationResult = { ok: true } | { ok: false; reason: string };

interface StoreValue {
  state: AppState | null;
  status: StoreStatus;
  memoryOnly: boolean;
  mutate: (change: (state: AppState) => AppState) => MutationResult;
  resetInvalid: () => void;
  reload: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [memoryOnly, setMemoryOnly] = useState(false);

  const reload = useCallback(() => {
    const loaded = loadDocument();
    if (loaded.kind === "ok") { setState(loaded.state); setMemoryOnly(false); setStatus("ready"); }
    else if (loaded.kind === "empty" || loaded.kind === "unavailable") {
      setState(newAppState()); setMemoryOnly(loaded.kind === "unavailable"); setStatus("ready");
    } else { setState(null); setStatus(loaded.kind); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setStatus("stale");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const mutate = useCallback((change: (current: AppState) => AppState): MutationResult => {
    if (status !== "ready" || state === null) return { ok: false, reason: "Reload this tab before editing." };
    const changed = change(state);
    const next = { ...changed, documentRevision: state.documentRevision + 1 };
    if (!isAppState(next)) return { ok: false, reason: "The change could not be saved safely." };
    const result = saveDocument(state, next, memoryOnly);
    if (result === "stale" || result === "blocked") {
      setStatus("stale");
      return { ok: false, reason: "Another tab changed your data. Reload before editing." };
    }
    if (result === "unavailable") setMemoryOnly(true);
    setState(next);
    return { ok: true };
  }, [memoryOnly, state, status]);

  const resetInvalid = useCallback(() => {
    if (!discardStoredDocument()) return;
    setState(newAppState()); setMemoryOnly(false); setStatus("ready");
  }, []);

  return <StoreContext.Provider value={{ state, status, memoryOnly, mutate, resetInvalid, reload }}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("AppStoreProvider is missing");
  return value;
}

/** Remove unstarted blocks; completed session history stays intact. */
export function removeFutureBlocks(state: AppState, assignmentId: string): AppState {
  if (!state.plan) return state;
  return { ...state, plan: { ...state.plan,
    blocks: state.plan.blocks.filter((block) => !(block.assignmentId === assignmentId && block.state === "scheduled")),
    shortfalls: state.plan.shortfalls.filter((shortfall) => shortfall.assignmentId !== assignmentId),
    overdueAssignmentIds: state.plan.overdueAssignmentIds.filter((id) => id !== assignmentId),
    outsideHorizonIds: state.plan.outsideHorizonIds.filter((id) => id !== assignmentId),
  } };
}

export function sortedAssignments(assignments: Assignment[], status: Assignment["status"]): Assignment[] {
  return assignments.filter((assignment) => assignment.status === status).sort((a, b) =>
    a.dueAt.localeCompare(b.dueAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
