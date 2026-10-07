import { NextRequest } from "next/server";
import { VerifyRequestSchema, type SSEEvent, type Stage, type Source } from "@/lib/types";
import { ingest, extractClaims, retrieveSources, classifySources, mapPool } from "@/lib/pipeline";
import { friendlyError } from "@/lib/groq";
import { analyzeProvenance } from "@/lib/provenance";
import { flagGeoMismatches } from "@/lib/geo";
import { scoreCliam, aggregateVerdict } from "@/lib/scoring";
import { detectOutletBias } from "@/lib/credibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
      const stageStart = (stage: Stage) => send({ type: "stage", stage, status: "start" });
      const stageDone = (stage: Stage) => send({ type: "stage", stage, status: "done" });

      try {
        // INGEST
        stageStart("INGEST");
        const { mode, article } = await ingest(input);
        send({ type: "data", stage: "INGEST", payload: { mode, article: { title: article.title, outlet: article.outlet, author: article.author, publishDate: article.publishDate, url: article.url, chars: article.text.length } } });
        stageDone("INGEST");

        // EXTRACT
        stageStart("EXTRACT");
        const claims = await extractClaims(article);
        send({ type: "data", stage: "EXTRACT", payload: { claims } });
        stageDone("EXTRACT");

        // RETRIEVE
        stageStart("RETRIEVE");
        const sourcesByClaim = new Map<string, Source[]>();
        await mapPool(claims, 2, async (claim) => {
          try {
            const sources = await retrieveSources(claim, article);
            sourcesByClaim.set(claim.id, sources);
            send({ type: "data", stage: "RETRIEVE", payload: { claimId: claim.id, sources } });
          } catch (e) {
            sourcesByClaim.set(claim.id, []);
            send({ type: "data", stage: "RETRIEVE", payload: { claimId: claim.id, sources: [], warning: e instanceof Error ? e.message : "Retrieval failed" } });
          }
        });
        stageDone("RETRIEVE");

        // CLASSIFY
        stageStart("CLASSIFY");
        const classifiedByClaim = new Map<string, Source[]>();
        await mapPool(claims, 2, async (claim) => {
          const raw = sourcesByClaim.get(claim.id) ?? [];
          const classified = await classifySources(claim, raw);
          classifiedByClaim.set(claim.id, classified);
          send({ type: "data", stage: "CLASSIFY", payload: { claimId: claim.id, sources: classified } });
        });
        stageDone("CLASSIFY");

        // PROVENANCE + GEO
        stageStart("PROVENANCE");
        const allClassified: Source[] = [...classifiedByClaim.values()].flat();
        const withProvenance = analyzeProvenance(allClassified);
        const withGeo = flagGeoMismatches(claims, withProvenance);
        const outletPatterns = detectOutletBias(withGeo);
        send({ type: "data", stage: "PROVENANCE", payload: { sources: withGeo, outletPatterns } });
        stageDone("PROVENANCE");

        // SCORE
        stageStart("SCORE");
        const results = claims.map((c) => scoreCliam(c.id, withGeo));
        const { overall, overallConfidence } = aggregateVerdict(results);
        send({ type: "data", stage: "SCORE", payload: { results, overall, overallConfidence } });
        stageDone("SCORE");

        // DONE
        stageStart("DONE");
        send({ type: "data", stage: "DONE", payload: { input, claims, sources: withGeo, results, overall, overallConfidence } });
        stageDone("DONE");

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
