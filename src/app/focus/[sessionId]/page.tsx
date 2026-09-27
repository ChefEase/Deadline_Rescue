"use client";

import { useParams } from "next/navigation";
import { StoreBoundary } from "@/components/StoreBoundary";
import { FocusView } from "@/features/focus/FocusView";

export default function FocusPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <StoreBoundary><FocusView sessionId={sessionId} /></StoreBoundary>;
}
