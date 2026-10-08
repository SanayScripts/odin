import type { Source } from "@/lib/types";

const CITATION_PATTERNS = [
  /\baccording to\b/i, /\breported by\b/i, /\bcites?\b/i,
  /\bquoting\b/i, /\bper\b /i, /\bvia\b /i, /\bsource[d]?\b.{0,20}\bfrom\b/i,
];

function hasCitationSignal(snippet: string): boolean {
  return CITATION_PATTERNS.some((re) => re.test(snippet));
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Syndication fingerprint: first 80 normalized chars of the snippet.
// Short snippets (<40 chars) are too weak to call a copy, so they return null.
function fingerprint(s: Source): string | null {
  const fp = norm(s.snippet ?? "").slice(0, 80);
  return fp.length >= 40 ? fp : null;
}

/**
 * Per claim:
 * - Original = earliest dated source. Undated sources are never original.
 * - Citation signal in snippet + an original exists → chain joins the original, citesSourceId set.
 * - Same snippet opening as an earlier chain root → syndicated copy, joins that chain.
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
    // Dated sources first, ascending; undated last
    group.sort((a, b) => {
      if (!a.publishDate && !b.publishDate) return 0;
      if (!a.publishDate) return 1;
      if (!b.publishDate) return -1;
      return a.publishDate.localeCompare(b.publishDate);
    });

    const origin = group.find((s) => s.publishDate) ?? null;
    const rootByFp = new Map<string, string>(); // fingerprint -> chain root id

    for (const s of group) {
      s.citesSourceId = null;
      s.isOriginal = !!origin && s.id === origin.id;

      if (s.isOriginal) {
        s.chainId = s.id;
      } else if (origin && hasCitationSignal((s.snippet ?? "").toLowerCase())) {
        s.citesSourceId = origin.id;
        s.chainId = origin.id;
      } else {
        const fp = fingerprint(s);
        const existingRoot = fp ? rootByFp.get(fp) : undefined;
        if (existingRoot) {
          s.chainId = existingRoot;      // syndicated copy
        } else {
          s.chainId = s.id;              // new independent chain
        }
      }

      const fp = fingerprint(s);
      if (fp && !rootByFp.has(fp)) rootByFp.set(fp, s.chainId as string);

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
