
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
