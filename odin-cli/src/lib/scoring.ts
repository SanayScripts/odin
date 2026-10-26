import type { Source, ClaimResult, Verdict } from "@/lib/types";

// Total weight at which evidence counts as "full". Tune here.
const EVIDENCE_SATURATION = 1.5;

function tierWeight(tier: number): number {
  return tier / 5;
}

function independenceFactor(source: Source): number {
  // Root of a chain (isOriginal or chainId === id) → 1; same chain follower → 0.25
  if (source.isOriginal || source.chainId === source.id) return 1;
  return 0.25;
}

export function scoreCliam(claimId: string, sources: Source[]): ClaimResult {
  const claimSources = sources.filter((s) => s.claimId === claimId);

  let support = 0;
  let conflict = 0;
  const chainsSeen = new Set<string>();

  for (const s of claimSources) {
    if (!s.stance || s.stance === "neutral") {
      if (s.chainId) chainsSeen.add(s.chainId);
      continue;
    }
    const tw = tierWeight(s.tier ?? 1);
    const conf = s.stanceConfidence ?? 0.5;
    const indep = independenceFactor(s);
    const weight = tw * conf * indep;

    if (s.stance === "supports") support += weight;
    else if (s.stance === "conflicts") conflict += weight;

    if (s.chainId) chainsSeen.add(s.chainId);
  }

  const independentChains = chainsSeen.size;
  const total = support + conflict;

  let verdict: Verdict;
  let confidence: number;

  if (independentChains < 2 || total === 0) {
    verdict = "insufficient";
    confidence = 0.3;
  } else {
    const ratio = support / total;
    // Direction: 0 at a 50/50 split, 1 when all weight sits on one side.
    const directional = Math.abs(ratio - 0.5) * 2;
    // Volume: little evidence caps confidence, so a single weak source can't read as certain.
    const volume = Math.min(1, total / EVIDENCE_SATURATION);
    confidence = Math.round(directional * volume * 100) / 100;

    if (ratio >= 0.65) verdict = "supported";
    else verdict = "contested";
  }

  return { claimId, verdict, confidence, independentChains, support, conflict };
}

const VERDICT_RANK: Record<Verdict, number> = {
  supported: 0,
  contested: 1,
  insufficient: 2,
};

export function aggregateVerdict(results: ClaimResult[]): {
  overall: Verdict;
  overallConfidence: number;
} {
  if (results.length === 0) return { overall: "insufficient", overallConfidence: 0 };
  // Worst-case across claims
  const worst = results.reduce((a, b) =>
    VERDICT_RANK[b.verdict] > VERDICT_RANK[a.verdict] ? b : a
  );
  const avgConf =
    results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  return { overall: worst.verdict, overallConfidence: Math.round(avgConf * 100) / 100 };
}
