import { z } from "zod";
import { generateJson } from "@/lib/groq";
import { getTier } from "@/lib/credibility";
import { fetchPage } from "@/lib/kali";
import type { Claim, Entity, Source } from "@/lib/types";

export type Article = {
  title: string | null;
  outlet: string | null;
  author: string | null;
  publishDate: string | null;
  url: string | null;
  text: string;
};

export const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = d.trim().match(/^\d{4}-\d{2}(?:-\d{2})?/);
  return m ? m[0] : null;
}

function normalizeEntityType(t: string): Entity["type"] {
  const s = t.toLowerCase();
  if (/^(person|people|individual)/.test(s)) return "person";
  if (/(org|company|agency|institution|group|party|government)/.test(s)) return "org";
  if (/(loc|place|city|country|gpe|region|state)/.test(s)) return "location";
  return "other";
}

export async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        await fn(item);
      }
    })
  );
}

/* ───────── INGEST ───────── */

const IngestSchema = z.object({
  title: z.string().nullish(),
  outlet: z.string().nullish(),
  author: z.string().nullish(),
  publishDate: z.string().nullish(),
  text: z.string(),
});

async function fetchViaJina(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain", "X-Return-Format": "text" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`);
  return res.text();
}

export async function ingest(input: string): Promise<{ mode: "url" | "text"; article: Article }> {
  const trimmed = input.trim();
  if (!isUrl(trimmed)) {
    return {
      mode: "text",
      article: { title: null, outlet: null, author: null, publishDate: null, url: null, text: trimmed },
    };
  }
  const raw = await fetchPage(trimmed);
  if (raw.trim().length < 200)
    throw new Error("Couldn't read that URL (paywalled or blocked). Paste the article text instead.");

  const body = raw.slice(0, 14000);
  const prompt = `Extract metadata from this article text. Return ONLY JSON:
{"title": string|null, "outlet": "publisher domain e.g. reuters.com", "author": string|null, "publishDate": "YYYY-MM-DD or null", "text": "faithful condensed main body, max 1200 words, no commentary"}

Rules: never guess date or author; use null if not stated.

ARTICLE:
"""
${body}
"""`;

  const data = await generateJson(prompt, IngestSchema);
  return {
    mode: "url",
    article: {
      title: data.title ?? null,
      outlet: data.outlet ?? hostOf(trimmed),
      author: data.author ?? null,
      publishDate: normalizeDate(data.publishDate),
      url: trimmed,
      text: data.text?.trim().length > 200 ? data.text : raw.slice(0, 6000),
    },
  };
}

/* ───────── EXTRACT ───────── */

const ExtractSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string(),
      entities: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
      dates: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
    })
  ),
});

export async function extractClaims(article: Article): Promise<Claim[]> {
  const body = article.text.slice(0, 12000);
  const prompt = `You are an OSINT analyst. Extract the central factual claims from the text below.

Rules:
- Return 3 to 5 claims for a full article; 1-2 for a short claim.
- Each claim must be atomic, independently verifiable, self-contained (resolve pronouns, name actors).
- Factual assertions only; skip opinions and predictions.
- entities: [{"name": string, "type": "person"|"org"|"location"|"other"}]
- dates: ISO dates referenced by the claim.
- locations: places referenced.

Return ONLY JSON: {"claims":[{"text":"...","entities":[...],"dates":[...],"locations":[...]}]}

TEXT:
"""
${body}
"""`;

  const data = await generateJson(prompt, ExtractSchema);
  const claims: Claim[] = data.claims
    .filter((c) => c.text.trim().length > 0)
    .slice(0, 5)
    .map((c, i) => ({
      id: `c${i + 1}`,
      text: c.text.trim(),
      entities: (c.entities ?? []).map((e) => ({ name: e.name, type: normalizeEntityType(e.type) })),
      dates: c.dates ?? [],
      locations: c.locations ?? [],
    }));

  if (claims.length === 0) throw new Error("No verifiable claims found in the input.");
  return claims;
}

/* ───────── RETRIEVE (Tavily) ───────── */

type TavilyResult = { title: string; url: string; content: string; published_date?: string };

async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set in .env.local");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, search_depth: "advanced", max_results: 8, include_answer: false }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
  const json = await res.json() as { results: TavilyResult[] };
  return json.results ?? [];
}

export async function retrieveSources(claim: Claim, article: Article): Promise<Source[]> {
  const entityNames = claim.entities.slice(0, 3).map((e) => e.name).join(" ");
  const query = `${claim.text.slice(0, 120)} ${entityNames}`.trim();
  const results = await tavilySearch(query);
  const filtered = results.filter(
    (r) => !article.url || !r.url.includes(new URL(article.url).hostname)
  );
  return filtered.slice(0, 8).map((r, i) => ({
    id: `${claim.id}-s${i + 1}`,
    claimId: claim.id,
    url: r.url,
    title: r.title || hostOf(r.url) || r.url,
    outlet: hostOf(r.url) ?? r.url,
    snippet: r.content?.slice(0, 1200) || undefined,
    publishDate: normalizeDate(r.published_date),
    author: null,
    tier: getTier(hostOf(r.url) ?? r.url),
  }));
}

/* ───────── CLASSIFY ───────── */

const ClassifySchema = z.object({
  classifications: z.array(
    z.object({
      sourceId: z.string(),
      stance: z.enum(["supports", "conflicts", "neutral"]),
      confidence: z.number().min(0).max(1),
      citesHint: z.string().nullable().optional(),
    })
  ),
});

export async function classifySources(
  claim: Claim,
  sources: Source[]
): Promise<Source[]> {
  if (sources.length === 0) return sources;

  const sourceList = sources
    .map(
      (s, i) =>
        `[${s.id}] "${s.title}" (${s.outlet})\nSnippet: ${s.snippet ?? "n/a"}`
    )
    .join("\n\n");

  const prompt = `You are an OSINT analyst. For each source below, classify its stance toward the claim.

CLAIM: "${claim.text}"

SOURCES:
${sourceList}

Rules:
- supports: source affirms or corroborates the claim
- conflicts: source contradicts or refutes the claim
- neutral: source mentions the topic but neither confirms nor denies
- confidence: float 0.0–1.0 reflecting how clearly the snippet aligns with the stance
- citesHint: if the snippet says "according to X" or "reported by X", put X here; else null

Return ONLY JSON:
{"classifications":[{"sourceId":"...","stance":"supports"|"conflicts"|"neutral","confidence":0.0,"citesHint":null}]}`;

  const data = await generateJson(prompt, ClassifySchema);

  const classMap = new Map(data.classifications.map((c) => [c.sourceId, c]));
  return sources.map((s) => {
    const c = classMap.get(s.id);
    if (!c) return s;
    return { ...s, stance: c.stance, stanceConfidence: c.confidence };
  });
}
