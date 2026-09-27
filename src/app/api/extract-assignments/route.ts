import { NextResponse } from "next/server";
import { parseExtractionRequest, parseModelDrafts } from "@/lib/extraction/drafts";
import { extractWithReplicate, ExtractionProviderError } from "@/lib/extraction/replicate";

export const runtime = "nodejs";

// A small per-instance limit protects the endpoint in local and single-instance use.
const requests = new Map<string, number[]>();

function allowed(client: string): boolean {
  const now = Date.now();
  const recent = (requests.get(client) || []).filter((at) => now - at < 10 * 60_000);
  if (recent.length >= 5) { requests.set(client, recent); return false; }
  requests.set(client, [...recent, now]);
  if (requests.size > 1000) {
    for (const [key, times] of requests) if (times.every((at) => now - at >= 10 * 60_000)) requests.delete(key);
  }
  return true;
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 16_000) {
    return NextResponse.json({ error: "Paste up to 12,000 characters." }, { status: 413 });
  }
  const body = await request.json().catch(() => null);
  const input = parseExtractionRequest(body);
  if (!input) return NextResponse.json({ error: "Add text up to 12,000 characters and try again." }, { status: 400 });
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowed(client)) return NextResponse.json({ error: "Too many extraction requests. Try again in a few minutes or add an assignment manually." }, { status: 429 });
  try {
    const result = parseModelDrafts(await extractWithReplicate(input), input.text);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof ExtractionProviderError ? error.code : "invalid_response";
    const message = code === "unconfigured"
      ? "AI extraction needs a Replicate API token. You can still add assignments manually."
      : code === "timeout" ? "Extraction took too long. Your pasted text is still here; try again or add it manually."
      : code === "invalid_response" ? "The AI returned an unreadable result. Your pasted text is still here; try again or add it manually."
      : "AI extraction is unavailable right now. Your pasted text is still here; try again or add it manually.";
    return NextResponse.json({ error: message }, { status: code === "unconfigured" ? 503 : code === "timeout" ? 504 : 502 });
  }
}
