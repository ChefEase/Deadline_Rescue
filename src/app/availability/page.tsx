"use client";

import { StoreBoundary } from "@/components/StoreBoundary";
import { AvailabilityEditor } from "@/features/availability/AvailabilityEditor";

export default function AvailabilityPage() {
  return <StoreBoundary><AvailabilityEditor /></StoreBoundary>;
}
