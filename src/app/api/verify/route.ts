import { NextRequest } from "next/server";
import { VerifyRequestSchema, type SSEEvent, type Stage } from "@/lib/types";
import { ingest, extractClaims, retrieveSources, mapPool } from "@/lib/pipeline";
import { friendlyError } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: SSEEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      const start = (stage: Stage) => send({ type: "stage", stage, status: "start" });
      const done = (stage: Stage) => send({ type: "stage", stage, status: "done" });

      try {
        // INGEST
        start("INGEST");
        const { mode, article } = await ingest(input);
        send({
          type: "data",
          stage: "INGEST",
          payload: {
            mode,
            article: {
              title: article.title,
              outlet: article.outlet,
              author: article.author,
              publishDate: article.publishDate,
              url: article.url,
              chars: article.text.length,
            },
          },
        });
        done("INGEST");

        // EXTRACT
        start("EXTRACT");
        const claims = await extractClaims(article);
        send({ type: "data", stage: "EXTRACT", payload: { claims } });
        done("EXTRACT");

        // RETRIEVE (≤2 claims in parallel; a failed claim doesn't abort the run)
        start("RETRIEVE");
        await mapPool(claims, 2, async (claim) => {
          try {
            const sources = await retrieveSources(claim, article);
            send({ type: "data", stage: "RETRIEVE", payload: { claimId: claim.id, sources } });
          } catch (e) {
            send({
              type: "data",
              stage: "RETRIEVE",
              payload: {
                claimId: claim.id,
                sources: [],
                warning: e instanceof Error ? e.message : "Retrieval failed",
              },
            });
          }
        });
        done("RETRIEVE");

        // Stubs — real logic lands in Batch 3
        for (const stage of ["CLASSIFY", "PROVENANCE", "SCORE", "DONE"] as Stage[]) {
          start(stage);
          await sleep(250);
          done(stage);
        }
      } catch (e) {
        send({ type: "error", message: friendlyError(e) });
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
