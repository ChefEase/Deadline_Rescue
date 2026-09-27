"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StoreBoundary } from "@/components/StoreBoundary";
import { TryExampleButton } from "@/features/demo/ExampleControls";
import { useAppStore } from "@/store/app-store";

function WelcomeContent() {
  const { state } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (!state) return;
    if (state.activeFocus) {
      router.replace(`/focus/${state.activeFocus.blockId}`);
    } else if (state.plan || state.assignments.some((item) => item.status === "completed")) {
      router.replace("/plan");
    } else if (state.assignments.some((item) => item.status === "active")) {
      router.replace(state.availabilityConfirmedAt ? "/plan" : "/availability");
    } else if (state.availabilityConfirmedAt) {
      router.replace("/assignments");
    }
  }, [router, state]);

  if (!state || state.plan || state.assignments.length > 0 || state.availabilityConfirmedAt) {
    return <section className="welcome-card"><p>Opening your saved work…</p></section>;
  }

  return (
    <section className="welcome-card">
      <p className="eyebrow">Deadline Rescue</p>
      <h1>One task at a time. A plan that fits.</h1>
      <p>Add your assignments and available time. Get a study plan that adjusts when life changes.</p>
      <div className="welcome-actions">
        <Link className="button" href="/assignments">Create my plan</Link>
        <TryExampleButton quiet />
      </div>
      <p className="supporting-text">Saved in this browser. No account needed.</p>
    </section>
  );
}

export default function WelcomePage() {
  return <StoreBoundary><WelcomeContent /></StoreBoundary>;
}
