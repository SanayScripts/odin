import type { Claim, Source, ClaimResult, Verdict } from "@/lib/types";

const ENTITY_CHIP: Record<string, string> = {
  person: "border-sky-800 bg-sky-950 text-sky-300",
  org: "border-violet-800 bg-violet-950 text-violet-300",
  location: "border-emerald-800 bg-emerald-950 text-emerald-300",
  other: "border-zinc-700 bg-zinc-900 text-zinc-300",
};

const STANCE_STYLE: Record<string, string> = {
  supports: "bg-emerald-900 text-emerald-300",
  conflicts: "bg-red-900 text-red-300",
  neutral: "bg-zinc-800 text-zinc-400",
};

const VERDICT_STYLE: Record<Verdict, string> = {
  supported: "border-emerald-700 bg-emerald-950 text-emerald-300",
  contested: "border-red-700 bg-red-950 text-red-300",
  insufficient: "border-zinc-600 bg-zinc-900 text-zinc-400",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  supported: "✓ Supported",
  contested: "✗ Contested",
  insufficient: "? Insufficient Evidence",
};

const TIER_LABEL: Record<number, string> = { 5: "Wire", 4: "Major", 3: "Regional", 2: "Aggregator", 1: "Blog" };

export default function ClaimCard({ index, claim, sources, warning, result }: {
  index: number; claim: Claim; sources?: Source[]; warning?: string; result?: ClaimResult;
}) {
  const supporting = sources?.filter((s) => s.stance === "supports") ?? [];
  const conflicting = sources?.filter((s) => s.stance === "conflicts") ?? [];
  const neutral = sources?.filter((s) => s.stance === "neutral" || !s.stance) ?? [];

  return (
    <article className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="mt-0.5 font-mono text-xs text-amber-500">C{index + 1}</span>
          <p className="text-sm font-medium leading-relaxed text-zinc-100">{claim.text}</p>
        </div>
        {result && (
          <span className={`shrink-0 rounded-lg border px-3 py-1 text-xs font-semibold ${VERDICT_STYLE[result.verdict]}`}>
            {VERDICT_LABEL[result.verdict]}
          </span>
        )}
      </div>

      {result && (
        <div className="flex gap-4 text-xs text-zinc-500">
          <span>Support <span className="text-emerald-400 font-mono">{result.support.toFixed(2)}</span></span>
          <span>Conflict <span className="text-red-400 font-mono">{result.conflict.toFixed(2)}</span></span>
          <span>Independent chains <span className="text-amber-400 font-mono">{result.independentChains}</span></span>
          <span>Confidence <span className="text-zinc-300 font-mono">{Math.round(result.confidence * 100)}%</span></span>
        </div>
      )}

      {(claim.entities.length > 0 || claim.locations.length > 0 || claim.dates.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {claim.entities.map((e, i) => (
            <span key={i} className={`rounded-md border px-2 py-0.5 text-xs ${ENTITY_CHIP[e.type]}`}>
              {e.name}<span className="ml-1 opacity-60">{e.type}</span>
            </span>
          ))}
          {claim.locations.map((l, i) => (
            <span key={`l${i}`} className={`rounded-md border px-2 py-0.5 text-xs ${ENTITY_CHIP.location}`}>📍 {l}</span>
          ))}
          {claim.dates.map((d, i) => (
            <span key={`d${i}`} className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">🗓 {d}</span>
          ))}
        </div>
      )}

      <div className="border-t border-zinc-800 pt-3">
        {sources === undefined ? (
          <p className="animate-pulse text-xs text-zinc-500">Retrieving sources…</p>
        ) : sources.length === 0 ? (
          <p className="text-xs text-zinc-500">No sources found.{warning ? ` (${warning})` : ""}</p>
        ) : (
          <div className="space-y-4">
            {warning && <p className="text-xs text-red-400">{warning}</p>}
            {[
              { label: `Supporting (${supporting.length})`, items: supporting, color: "text-emerald-400" },
              { label: `Conflicting (${conflicting.length})`, items: conflicting, color: "text-red-400" },
              { label: `Neutral (${neutral.length})`, items: neutral, color: "text-zinc-500" },
            ].map(({ label, items, color }) =>
              items.length > 0 ? (
                <div key={label}>
                  <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</p>
                  <ul className="space-y-3">
                    {items.map((s) => (
                      <li key={s.id} className="text-xs">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <span>{s.outlet}</span>
                          {s.tier && <span className="rounded px-1 bg-zinc-800 text-zinc-400">{TIER_LABEL[s.tier] ?? `T${s.tier}`}</span>}
                          {s.isOriginal && <span className="rounded px-1 bg-amber-900 text-amber-300">Original</span>}
                          {s.geoMismatch && <span className="rounded px-1 bg-orange-900 text-orange-300">Geo mismatch</span>}
                          {s.stance && <span className={`rounded px-1 ${STANCE_STYLE[s.stance]}`}>{s.stance} {s.stanceConfidence != null ? `${Math.round(s.stanceConfidence * 100)}%` : ""}</span>}
                          {s.publishDate && <span>{s.publishDate}</span>}
                        </div>
                        <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-zinc-200 hover:text-amber-400">{s.title}</a>
                        {s.snippet && <p className="mt-0.5 text-zinc-400">{s.snippet}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </article>
  );
}
