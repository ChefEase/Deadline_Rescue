import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Assignment extraction is not available yet. Use manual entry when it is added." },
    { status: 501 },
  );
}
