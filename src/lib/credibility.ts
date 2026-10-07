const TIER_MAP: Record<string, number> = {
  // Tier 5 — official/wire
  "reuters.com": 5, "apnews.com": 5, "bbc.com": 5, "bbc.co.uk": 5,
  "afp.com": 5, "un.org": 5, "who.int": 5, "gov.uk": 5, "state.gov": 5,
  // Tier 4 — major outlets
  "nytimes.com": 4, "theguardian.com": 4, "washingtonpost.com": 4,
  "economist.com": 4, "ft.com": 4, "wsj.com": 4, "bloomberg.com": 4,
  "aljazeera.com": 4, "dw.com": 4, "france24.com": 4, "npr.org": 4,
  "theatlantic.com": 4, "time.com": 4, "foreignpolicy.com": 4,
  // Tier 3 — regional / specialist
  "thehindu.com": 3, "hindustantimes.com": 3, "ndtv.com": 3,
  "timesofindia.com": 3, "scroll.in": 3, "thewire.in": 3,
  "politico.com": 3, "axios.com": 3, "theintercept.com": 3,
  "propublica.org": 3, "bellingcat.com": 3, "techcrunch.com": 3,
  "arstechnica.com": 3, "wired.com": 3, "nature.com": 3,
  "sciencedirect.com": 3, "theverge.com": 3,
  // Tier 2 — aggregator / secondary
  "msn.com": 2, "yahoo.com": 2, "huffpost.com": 2, "buzzfeed.com": 2,
  "dailymail.co.uk": 2, "nypost.com": 2, "mirror.co.uk": 2,
  "indiatoday.in": 2, "firstpost.com": 2, "news18.com": 2,
  // Tier 1 — blog / unknown (default)
};

export function getTier(outlet: string): number {
  const host = outlet.replace(/^www\./, "").toLowerCase();
  return TIER_MAP[host] ?? 1;
}

export type OutletPattern = {
  outlet: string;
  dominantStance: "supports" | "conflicts";
  count: number;
  flagged: boolean;
};

export function detectOutletBias(
  sources: Array<{ outlet: string; stance?: string }>
): OutletPattern[] {
  const map = new Map<string, { supports: number; conflicts: number; neutral: number }>();
  for (const s of sources) {
    if (!s.stance) continue;
    const rec = map.get(s.outlet) ?? { supports: 0, conflicts: 0, neutral: 0 };
    if (s.stance === "supports") rec.supports++;
    else if (s.stance === "conflicts") rec.conflicts++;
    else rec.neutral++;
    map.set(s.outlet, rec);
  }
  const patterns: OutletPattern[] = [];
  for (const [outlet, counts] of map) {
    const total = counts.supports + counts.conflicts + counts.neutral;
    if (total < 2) continue;
    const dominant = counts.supports >= counts.conflicts ? "supports" : "conflicts";
    const dominantCount = dominant === "supports" ? counts.supports : counts.conflicts;
    if (dominantCount / total >= 0.85) {
      patterns.push({ outlet, dominantStance: dominant, count: total, flagged: true });
    }
  }
  return patterns;
}
