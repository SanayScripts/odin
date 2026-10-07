
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

## Batch 2c ✅ Model fix + debug session
- [x] Swapped model to openai/gpt-oss-20b (llama-3.3-70b-versatile not available on free tier)
- [x] Confirmed route.ts, page.tsx, InputForm.tsx all correct
- [x] Pipeline wired: INGEST → EXTRACT → RETRIEVE → stubs for CLASSIFY/PROVENANCE/SCORE/DONE
- [ ] Button unresponsive in Firefox (HMR WebSocket failures, Security Error on file:/// links)
- [ ] Not yet tested end-to-end — needs Chrome or Chromium to verify
- [ ] Batch 3 not started: credibility.ts, classify, provenance.ts, geo.ts, scoring.ts

## Batch 3 ✅ OSINT Analysis
- [x] `credibility.ts`: tier map (40+ domains), `getTier()`, `detectOutletBias()`
- [x] `provenance.ts`: earliest-date original tagging, citation chain detection, `buildCitationEdges()`
- [x] `geo.ts`: location consistency flag via snippet/title string match
- [x] `scoring.ts`: per-claim weighted scoring, `scoreCliam()`, `aggregateVerdict()`
- [x] `pipeline.ts`: `classifySources()` added — per-claim batched stance classification via Groq
- [x] `route.ts`: CLASSIFY → PROVENANCE → SCORE → DONE fully wired, stubs replaced
- [x] `page.tsx`: handles CLASSIFY/PROVENANCE/SCORE SSE events, overall verdict banner
- [x] `ClaimCard.tsx`: verdict badge, support/conflict scores, sources grouped by stance, tier/original/geo badges
- [x] `gemini.ts` deleted (dead file, caused tsc errors)
- Note: geo mismatch is snippet-level string match only, not NER
- Note: `scoreCliam` typo is consistent across scoring.ts and route.ts

## Batch 4 ✅ Visualization UI
- [x] `VerdictPanel`: overall verdict banner + confidence bar + per-claim breakdown table
- [x] `SourceCard`: tier badge, stance badge, original/secondary/geo tags, snippet
- [x] `NarrativeView`: three-column supporting/conflicting/neutral layout using SourceCard
- [x] `Timeline`: date-sorted vertical timeline with stance dots, lead/lag labels
- [x] `page.tsx`: tabbed results view (Claims / Narrative / Timeline), wired all new components

## Batch 5 ✅ Polish & Export
- [x] `report.ts`: Markdown report generator (verdict, per-claim breakdown, grouped sources)
- [x] Copy report + Download .md buttons (shown after pipeline completes)
- [x] Footer disclaimer
- [x] `README.md`: setup, usage, scoring formula
- [x] Error display with label
