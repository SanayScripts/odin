import { NextRequest } from "next/server";
import { VerifyRequestSchema, STAGES, type SSEEvent, type Stage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = VerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const input = parsed.data.input;
  const mode = isUrl(input) ? "url" : "text";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: SSEEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));

      try {
        // Stub pipeline — real stage logic lands in Batches 2–3
        for (const stage of STAGES as readonly Stage[]) {
          send({ type: "stage", stage, status: "start" });
          if (stage === "INGEST") send({ type: "data", stage, payload: { mode, input } });
          await sleep(600);
          send({ type: "stage", stage, status: "done" });
        }
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
