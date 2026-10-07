import { z } from "zod";
import { generateJson } from "@/lib/gemini";
import type { Claim, Entity, Source } from "@/lib/types";

export type Article = {
  title: string | null;
  outlet: string | null;
  author: string | null;
  publishDate: string | null;
  url: string | null;
  text: string;
};

/* ───────── helpers ───────── */

export const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function sameUrl(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    const key = (u: URL) => (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "")).toLowerCase();
    return key(x) === key(y);
  } catch {
    return false;
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

/** Grounding URIs are Google redirect links; resolve to the real article URL. */
async function resolveUrl(uri: string): Promise<string> {
  if (!uri.includes("vertexaisearch.cloud.google.com")) return uri;
  try {
    const res = await fetch(uri, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    return res.headers.get("location") ?? uri;
  } catch {
    return uri;
  }
}

/* ───────── INGEST ───────── */

const IngestSchema = z.object({
  title: z.string().nullish(),
  outlet: z.string().nullish(),
  author: z.string().nullish(),
  publishDate: z.string().nullish(),
  text: z.string(),
});

export async function ingest(input: string): Promise<{ mode: "url" | "text"; article: Article }> {
  const trimmed = input.trim();

  if (!isUrl(trimmed)) {
    return {
      mode: "text",
      article: { title: null, outlet: null, author: null, publishDate: null, url: null, text: trimmed },
    };
  }

  const prompt = `Use the URL context tool to read this page: ${trimmed}

Return ONLY a JSON object, no commentary:
{"title": string|null, "outlet": "publisher domain e.g. reuters.com", "author": string|null, "publishDate": "YYYY-MM-DD or null", "text": "faithful condensed main body text of the article, max ~1200 words, no commentary"}

Rules: never guess the date or author; use null if not stated on the page. If you cannot access the page, return {"title":null,"outlet":null,"author":null,"publishDate":null,"text":""}.`;

  const { data } = await generateJson(prompt, IngestSchema, { tools: [{ urlContext: {} }] });

  if (data.text.trim().length < 200) {
    throw new Error("Couldn't read that URL (paywalled or blocked). Paste the article text instead.");
  }

  return {
    mode: "url",
    article: {
      title: data.title ?? null,
      outlet: data.outlet ?? hostOf(trimmed),
      author: data.author ?? null,
      publishDate: normalizeDate(data.publishDate),
      url: trimmed,
      text: data.text,
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
- For a full article return 3 to 5 claims. If the text is itself a short claim, return just 1-2.
- Each claim must be atomic, independently verifiable, and self-contained (resolve pronouns, name the actors).
- Factual assertions only; skip opinions and predictions.
- entities: [{"name": string, "type": "person" | "org" | "location" | "other"}]
- dates: dates/times referenced by the claim (ISO where possible).
- locations: places referenced by the claim.

Return ONLY JSON: {"claims":[{"text":"...","entities":[...],"dates":[...],"locations":[...]}]}

TEXT:
"""
${body}
"""`;

  const { data } = await generateJson(prompt, ExtractSchema);

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

/* ───────── RETRIEVE ───────── */

const RetrieveSchema = z.object({
  sources: z.array(
    z.object({
      title: z.string().nullish(),
      outlet: z.string().nullish(),
      snippet: z.string().nullish(),
      publishDate: z.string().nullish(),
      author: z.string().nullish(),
    })
  ),
});

type Candidate = { url: string; outlet: string; title: string };

export async function retrieveSources(claim: Claim, article: Article): Promise<Source[]> {
  const ctx = [
    article.title ? `Origin article: "${article.title}"${article.outlet ? ` (${article.outlet})` : ""}` : null,
    claim.entities.length ? `Entities: ${claim.entities.map((e) => `${e.name} [${e.type}]`).join(", ")}` : null,
    claim.locations.length ? `Locations: ${claim.locations.join(", ")}` : null,
    claim.dates.length ? `Dates: ${claim.dates.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are an OSINT analyst. Use Google Search to find independent public sources (news outlets, wire services, official statements, fact-checkers) that report on or bear on this claim.

CLAIM: ${claim.text}
${ctx}

Rules:
- Prefer original/primary reporting. Include sources that CONTRADICT the claim as well as ones that support it.
- Only list pages you actually found through search. Never invent sources.
- Max 8 sources.

Return ONLY JSON:
{"sources":[{"title":"article headline","outlet":"domain e.g. reuters.com","snippet":"1-2 neutral sentences on what this source says about the claim","publishDate":"YYYY-MM-DD or null","author":"name or null"}]}`;

  const { data, raw } = await generateJson(prompt, RetrieveSchema, { tools: [{ googleSearch: {} }] });

  // Real URLs come ONLY from grounding metadata, never from model text.
  const chunks = raw.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const resolved = await Promise.all(
    chunks.map(async (c): Promise<Candidate | null> => {
      const uri = c.web?.uri;
      if (!uri) return null;
      const url = await resolveUrl(uri);
      const host = hostOf(url);
      const title = c.web?.title ?? "";
      const outlet =
        host && !host.includes("vertexaisearch") ? host : title.replace(/^www\./, "").toLowerCase();
      return { url, outlet, title };
    })
  );

  const seen = new Set<string>();
  const pool: Candidate[] = [];
  for (const c of resolved) {
    if (!c || seen.has(c.url)) continue;
    if (article.url && sameUrl(c.url, article.url)) continue; // origin article isn't independent
    seen.add(c.url);
    pool.push(c);
  }

  const used = new Set<number>();
  const out: Omit<Source, "id">[] = [];

  for (const m of data.sources) {
    const o = (m.outlet ?? "").replace(/^www\./, "").toLowerCase();
    if (!o) continue;
    const idx = pool.findIndex(
      (p, i) =>
        !used.has(i) &&
        p.outlet !== "" &&
        (p.outlet === o || p.outlet.endsWith("." + o) || o.endsWith("." + p.outlet) || p.outlet.includes(o))
    );
    if (idx === -1) continue; // no grounding match → can't trust a URL → drop
    used.add(idx);
    const p = pool[idx];
    out.push({
      claimId: claim.id,
      url: p.url,
      title: m.title?.trim() || p.title || p.outlet,
      outlet: p.outlet,
      snippet: m.snippet ?? undefined,
      publishDate: normalizeDate(m.publishDate),
      author: m.author ?? null,
    });
  }

  // Grounded sources the model didn't describe still count as real evidence
  pool.forEach((p, i) => {
    if (used.has(i)) return;
    out.push({
      claimId: claim.id,
      url: p.url,
      title: p.title || p.outlet,
      outlet: p.outlet,
      publishDate: null,
      author: null,
    });
  });

  return out.slice(0, 8).map((s, i) => ({ ...s, id: `${claim.id}-s${i + 1}` }));
}
