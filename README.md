# Odin

OSINT news verification tool. Submit a news URL or a plain-text claim; Odin extracts atomic claims, retrieves independent sources, classifies stance, traces provenance, and produces a corroboration-based verdict.

## Stack

- Next.js 14+ (App Router), TypeScript, Tailwind CSS
- Groq (`openai/gpt-oss-20b`) — claim extraction + stance classification
- Tavily Search API — source retrieval
- Jina Reader (`r.jina.ai`) — article ingestion

## Setup

```bash
npm install
```

Create `.env.local`:

```
GROQ_API_KEY=your_key
TAVILY_API_KEY=your_key
```

```bash
npm run dev
```

Open `http://localhost:3000`.

## Usage

- **URL input:** paste any news article URL. Jina fetches the text; Groq extracts claims.
- **Text input:** paste a claim directly (min 8 chars).

Pipeline: Ingest → Extract claims → Retrieve sources → Classify stance → Trace provenance → Score & verdict.

## Scoring

Per-source weight = `(tier/5) × stanceConfidence × independenceFactor`  
`independenceFactor`: 1 for chain root, 0.25 for secondary in same citation chain.

Per-claim verdict:
- `< 2` independent chains → **Insufficient Evidence**
- support ratio ≥ 0.65 → **Supported**
- support ratio ≤ 0.35 → **Contested (leaning false)**
- otherwise → **Contested**

Overall = worst-case across claims.

## Notes

- Free-tier Groq rate limits apply; large articles with many claims may be slow.
- Geo mismatch is snippet-level string match, not NER.
- Source dates and authors are model-reported from Tavily snippets, not verified.
