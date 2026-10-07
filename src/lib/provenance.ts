import type { Source } from "@/lib/types";

const CITATION_PATTERNS = [
  /\baccording to\b/i, /\breported by\b/i, /\bcites?\b/i,
  /\bquoting\b/i, /\bper\b /i, /\bvia\b /i, /\bsource[d]?\b.{0,20}\bfrom\b/i,
];

function hasCitationSignal(snippet: string): boolean {
  return CITATION_PATTERNS.some((re) => re.test(snippet));
}

/** Tag original vs secondary; assign chainIds; link citesSourceId. */
export function analyzeProvenance(sources: Source[]): Source[] {
  // Sort by date ascending — nulls last
  const sorted = [...sources].sort((a, b) => {
    if (!a.publishDate && !b.publishDate) return 0;
    if (!a.publishDate) return 1;
    if (!b.publishDate) return -1;
    return a.publishDate.localeCompare(b.publishDate);
  });

  const result: Source[] = sorted.map((s, i) => ({ ...s }));

  // Earliest per claimId = candidate original
  const firstPerClaim = new Map<string, string>(); // claimId -> sourceId
  for (const s of result) {
    if (!firstPerClaim.has(s.claimId)) firstPerClaim.set(s.claimId, s.id);
  }

  for (const s of result) {
    const isFirst = firstPerClaim.get(s.claimId) === s.id;
    s.isOriginal = isFirst;
  }

  // Citation chain: secondary that has citation signal → link to original of same claim
  for (const s of result) {
    if (s.isOriginal) {
      s.chainId = s.id;
      s.citesSourceId = null;
      continue;
    }
    const snippet = (s.snippet ?? "").toLowerCase();
    const originId = firstPerClaim.get(s.claimId) ?? null;
    if (hasCitationSignal(snippet) && originId) {
      s.citesSourceId = originId;
      s.chainId = originId;
    } else {
      s.citesSourceId = null;
      s.chainId = s.id; // independent chain
    }
  }

  return result;
}

export type CitationEdge = { from: string; to: string };

export function buildCitationEdges(sources: Source[]): CitationEdge[] {
  return sources
    .filter((s) => s.citesSourceId != null)
    .map((s) => ({ from: s.id, to: s.citesSourceId! }));
}
