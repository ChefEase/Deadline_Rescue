"use client";

import { StoreBoundary } from "@/components/StoreBoundary";
import { PlanView } from "@/features/planning/PlanView";

export default function PlanPage() {
  return <StoreBoundary><PlanView /></StoreBoundary>;
}
