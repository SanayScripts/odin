import type { Source } from "@/lib/types";

const CITATION_PATTERNS = [
  /\baccording to\b/i, /\breported by\b/i, /\bcites?\b/i,
  /\bquoting\b/i, /\bper\b /i, /\bvia\b /i, /\bsource[d]?\b.{0,20}\bfrom\b/i,
];

function hasCitationSignal(snippet: string): boolean {
  return CITATION_PATTERNS.some((re) => re.test(snippet));
}

const STOP = new Set(["the", "a", "an", "of", "in", "on", "to", "and", "for", "is", "was", "by", "at", "with"]);

// Normalized title tokens, minus stopwords. Two titles "match" when they share
// at least 70% of their tokens (Jaccard-style on the smaller set).
function titleTokens(s: Source): Set<string> {
  const words = (s.title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  return new Set(words);
}

function sameStory(a: Set<string>, b: Set<string>): boolean {
  if (a.size < 3 || b.size < 3) return false;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size) >= 0.7;
}

/**
 * Per claim:
 * - Original = earliest dated source. Undated sources are never original.
 * - Citation signal in snippet + an original exists → joins the original, citesSourceId set.
 * - Title matches an earlier chain root (same story) → syndicated copy, joins that chain.
 * - Otherwise → new independent chain (chainId = own id).
 * Export signatures unchanged.
 */
export function analyzeProvenance(sources: Source[]): Source[] {
  const byClaim = new Map<string, Source[]>();
  for (const s of sources) {
    const arr = byClaim.get(s.claimId) ?? [];
    arr.push({ ...s });
    byClaim.set(s.claimId, arr);
  }

  const out: Source[] = [];

  for (const group of byClaim.values()) {
    group.sort((a, b) => {
      if (!a.publishDate && !b.publishDate) return 0;
      if (!a.publishDate) return 1;
      if (!b.publishDate) return -1;
      return a.publishDate.localeCompare(b.publishDate);
    });

    const origin = group.find((s) => s.publishDate) ?? null;
    const roots: { tokens: Set<string>; chainId: string }[] = [];

    for (const s of group) {
      s.citesSourceId = null;
      s.isOriginal = !!origin && s.id === origin.id;
      const tokens = titleTokens(s);

      if (s.isOriginal) {
        s.chainId = s.id;
      } else if (origin && hasCitationSignal((s.snippet ?? "").toLowerCase())) {
        s.citesSourceId = origin.id;
        s.chainId = origin.id;
      } else {
        const match = roots.find((r) => sameStory(r.tokens, tokens));
        s.chainId = match ? match.chainId : s.id;
      }

      if (!roots.some((r) => r.chainId === s.chainId)) {
        roots.push({ tokens, chainId: s.chainId as string });
      }

      out.push(s);
    }
  }

  return out;
}

export type CitationEdge = { from: string; to: string };

export function buildCitationEdges(sources: Source[]): CitationEdge[] {
  return sources
    .filter((s) => s.citesSourceId != null)
    .map((s) => ({ from: s.id, to: s.citesSourceId! }));
}
