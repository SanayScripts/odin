
## Batch 1 ✅ Foundation
- [x] Zod schemas + SSE event types (`src/lib/types.ts`)
- [x] Gemini client + `generateJson` helper (`src/lib/gemini.ts`)
- [x] SSE stub route with input validation (`api/verify/route.ts`)
- [x] InputForm, PipelineProgress, dark-theme layout, streaming page
- Note: `generateJson` skips JSON mime type when tools are passed (Gemini limitation); fences stripped manually.
- Note: deps installed manually after init script's `npm install` didn't persist.
