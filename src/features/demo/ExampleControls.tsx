"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createExampleState } from "@/lib/demo/sample-data";
import { newAppState } from "@/lib/persistence/storage";
import { useAppStore } from "@/store/app-store";

function hasPersonalWork(state: NonNullable<ReturnType<typeof useAppStore>["state"]>): boolean {
  return state.assignments.length > 0 || state.commitments.length > 0 || state.studyWindows.length > 0 ||
    state.availabilityConfirmedAt !== null || state.plan !== null || state.workLogs.length > 0;
}

/** All example replacement flows use the same explicit confirmation and atomic save. */
function useExampleActions() {
  const { state, mutate } = useAppStore();
  const router = useRouter();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function loadExample(reset = false) {
    if (!state || busyRef.current) return;
    if (reset && !window.confirm("Reset the example? This will remove changes and Focus progress made in the example.")) return;
    if (!reset && state.mode === "personal" && hasPersonalWork(state) && !window.confirm(
      "Replace your assignments, study hours, commitments, plan, and Focus history with example data? Your personal work in this browser will be deleted.",
    )) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const example = createExampleState(state, new Date().toISOString());
      const result = mutate(() => example);
      if (!result.ok) { setError(result.reason); return; }
      router.push("/plan");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the example.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function startOwnPlan() {
    if (!state || busyRef.current || !window.confirm(
      "Start your own plan? This deletes the example assignments, commitments, plan, and Focus history from this browser.",
    )) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    const result = mutate(() => newAppState());
    if (result.ok) router.push("/assignments");
    else setError(result.reason);
    busyRef.current = false;
    setBusy(false);
  }

  return { busy, error, loadExample, startOwnPlan };
}

export function TryExampleButton({ quiet = false }: { quiet?: boolean }) {
  const { busy, error, loadExample } = useExampleActions();
  return <span className="example-action">
    <button type="button" className={quiet ? "button button-secondary" : "button"} disabled={busy} onClick={() => loadExample()}>
      {busy ? "Loading example…" : "Try an example"}
    </button>
    {error && <span className="form-error" role="alert">{error}</span>}
  </span>;
}

export function ExampleBanner({ focus = false }: { focus?: boolean }) {
  const { busy, error, loadExample, startOwnPlan } = useExampleActions();
  return <div className="example-banner" role="status">
    <div><strong>Example data</strong><span>Changes here affect only this browser&apos;s sample plan.</span></div>
    {!focus && <div className="example-banner-actions">
      <button type="button" className="text-button" disabled={busy} onClick={() => loadExample(true)}>Reset example</button>
      <button type="button" className="button button-secondary" disabled={busy} onClick={startOwnPlan}>Start my own plan</button>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
