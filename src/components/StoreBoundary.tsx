"use client";

import type { ReactNode } from "react";
import { useAppStore } from "@/store/app-store";
import { STORAGE_KEY } from "@/lib/persistence/storage";

export function StoreBoundary({ children }: { children: ReactNode }) {
  const { state, status, memoryOnly, reload, resetInvalid } = useAppStore();
  if (status === "loading" || (status === "ready" && !state)) return <section className="page-card"><p>Loading your work…</p></section>;
  if (status === "stale") return <section className="page-card"><h1>This tab needs a refresh</h1><p>Your work changed in another tab. Reload the saved copy before editing here.</p><button className="button" onClick={reload}>Reload saved work</button></section>;
  if (status === "invalid" || status === "unsupported") return <section className="page-card"><h1>Saved work needs attention</h1><p>{status === "unsupported" ? "This browser has data from a newer app version." : "The saved data could not be read safely."} Your data has not been replaced.</p><p>Export a copy before starting over.</p><div className="action-row"><button className="button button-secondary" onClick={() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return;
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "deadline-rescue-recovery.json"; link.click();
    URL.revokeObjectURL(url);
  }}>Download saved data</button><button className="button button-danger" onClick={() => {
    if (window.confirm("Delete the saved data in this browser and start fresh? Download a copy first if you may need it.")) resetInvalid();
  }}>Start fresh</button></div></section>;
  return <>{memoryOnly && <p className="storage-warning" role="status">Browser storage is unavailable. You can keep working, but a refresh may lose changes.</p>}{children}</>;
}
