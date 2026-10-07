import type { Claim, Source } from "@/lib/types";

/** Very lightweight: flag a source if its snippet mentions a location
 *  that directly contradicts the claim's locations (different country-level names).
 *  Full NER is overkill here — simple string presence check. */
export function flagGeoMismatches(
  claims: Claim[],
  sources: Source[]
): Source[] {
  const claimLocMap = new Map<string, Set<string>>();
  for (const c of claims) {
    claimLocMap.set(
      c.id,
      new Set(c.locations.map((l) => l.toLowerCase()))
    );
  }

  return sources.map((s) => {
    const claimLocs = claimLocMap.get(s.claimId);
    if (!claimLocs || claimLocs.size === 0) return { ...s, geoMismatch: false };

    const snippet = (s.snippet ?? s.title ?? "").toLowerCase();

    // If snippet mentions none of the claim locations → potential mismatch
    const anyMatch = [...claimLocs].some((loc) => snippet.includes(loc));
    return { ...s, geoMismatch: !anyMatch };
  });
}
