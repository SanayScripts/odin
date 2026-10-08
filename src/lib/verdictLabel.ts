import type { ClaimResult } from "@/lib/types";

// Spec thresholds: ratio ≤ 0.35 → leaning false, ≥ 0.65 → leaning true.
export function leanOf(r: Pick<ClaimResult, "support" | "conflict">): "false" | "true" | null {
  const total = r.support + r.conflict;
  if (total === 0) return null;
  const ratio = r.support / total;
  if (ratio <= 0.35) return "false";
  if (ratio >= 0.65) return "true";
  return null;
}

export function contestedLabel(r: Pick<ClaimResult, "support" | "conflict">): string {
  const lean = leanOf(r);
  if (lean === "false") return "✗ Contested · leaning false";
  if (lean === "true") return "✗ Contested · leaning true";
  return "✗ Contested";
}
