
## Batch 1 ✅ Foundation
- [x] Zod schemas + SSE event types (`src/lib/types.ts`)
- [x] Gemini client + `generateJson` helper (`src/lib/gemini.ts`)
- [x] SSE stub route with input validation (`api/verify/route.ts`)
- [x] InputForm, PipelineProgress, dark-theme layout, streaming page
- Note: `generateJson` skips JSON mime type when tools are passed (Gemini limitation); fences stripped manually.
- Note: deps installed manually after init script's `npm install` didn't persist.

## Batch 2 ✅ Extraction & Retrieval
- [x] `gemini.ts`: JSON extraction from chatty output, retry on 429/503
- [x] `pipeline.ts`: ingest (url_context), extractClaims, retrieveSources (google_search), mapPool (concurrency 2)
- [x] Real URLs from grounding metadata only; Google redirect links resolved server-side; origin article excluded
- [x] SSE route wired: INGEST → EXTRACT → RETRIEVE live; CLASSIFY/PROVENANCE/SCORE still stubs
- [x] ClaimCard (entity/location/date chips + retrieved sources), progressive page rendering
- Note: source dates/authors are model-reported, not verified

## Batch 2b ✅ Provider swap — Groq + Jina + Tavily
- [x] Dropped Gemini entirely (removed @google/genai, reactflow, recharts)
- [x] `groq.ts`: Groq SDK, llama-3.3-70b-versatile, native JSON mode, retry on 429/503
- [x] `ingest`: URL fetched via Jina Reader (r.jina.ai), no API key needed
- [x] `retrieveSources`: Tavily Search API — real URLs returned directly, no redirect resolution
- [x] `extractClaims`: unchanged logic, now calls groq.ts
- [x] route.ts: import updated to groq.ts

## Batch 2b ✅ Provider swap — Groq + Jina + Tavily
- [x] Dropped Gemini entirely (removed @google/genai)
- [x] `groq.ts`: Groq SDK, retry on 429/503, JSON mode
- [x] `ingest`: URL fetched via Jina Reader (r.jina.ai)
- [x] `retrieveSources`: Tavily Search API — real URLs
- [x] route.ts: import updated to groq.ts
- [ ] BLOCKED: llama-3.3-70b-versatile not found — need to swap model name
