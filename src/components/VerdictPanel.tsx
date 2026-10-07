import type { ClaimResult, Verdict } from "@/lib/types";

const VERDICT_STYLE: Record<Verdict, { border: string; bg: string; text: string; label: string }> = {
  supported:   { border: "border-emerald-700", bg: "bg-emerald-950", text: "text-emerald-300", label: "✓ Supported" },
  contested:   { border: "border-red-700",     bg: "bg-red-950",     text: "text-red-300",     label: "✗ Contested" },
  insufficient:{ border: "border-zinc-600",    bg: "bg-zinc-900",    text: "text-zinc-400",    label: "? Insufficient Evidence" },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.65 ? "bg-emerald-500" : value >= 0.4 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="h-1.5 flex-1 rounded-full bg-zinc-800">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400 font-mono w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function VerdictPanel({
  overall,
  confidence,
  results,
}: {
  overall: Verdict;
  confidence: number;
  results: ClaimResult[];
}) {
  const v = VERDICT_STYLE[overall];
  return (
    <section className="space-y-4">
      <div className={`rounded-xl border p-5 ${v.border} ${v.bg}`}>
        <p className="text-xs uppercase tracking-wide opacity-60 mb-1">Overall verdict</p>
        <p className={`text-2xl font-bold ${v.text}`}>{v.label}</p>
        <ConfidenceBar value={confidence} />
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold">Per-claim breakdown</p>
          {results.map((r, i) => {
            const rv = VERDICT_STYLE[r.verdict];
            const total = r.support + r.conflict;
            const supportPct = total > 0 ? Math.round((r.support / total) * 100) : 0;
            return (
              <div key={r.claimId} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-amber-500 w-6 shrink-0">C{i + 1}</span>
                <span className={`rounded border px-2 py-0.5 font-semibold shrink-0 ${rv.border} ${rv.bg} ${rv.text}`}>{rv.label}</span>
                <div className="flex-1 flex items-center gap-2 text-zinc-500 min-w-0">
                  <span className="text-emerald-400">{r.support.toFixed(2)} sup</span>
                  <span className="text-red-400">{r.conflict.toFixed(2)} con</span>
                  <span>{r.independentChains} chains</span>
                  {total > 0 && <span className="text-zinc-300">{supportPct}% support</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
