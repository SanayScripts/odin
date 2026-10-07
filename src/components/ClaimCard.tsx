import type { Claim, Source } from "@/lib/types";

const CHIP: Record<string, string> = {
  person: "border-sky-800 bg-sky-950 text-sky-300",
  org: "border-violet-800 bg-violet-950 text-violet-300",
  location: "border-emerald-800 bg-emerald-950 text-emerald-300",
  other: "border-zinc-700 bg-zinc-900 text-zinc-300",
};

export default function ClaimCard({
  index,
  claim,
  sources,
  warning,
}: {
  index: number;
  claim: Claim;
  sources?: Source[];
  warning?: string;
}) {
  return (
    <article className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex gap-3">
        <span className="mt-0.5 font-mono text-xs text-amber-500">C{index + 1}</span>
        <p className="text-sm font-medium leading-relaxed text-zinc-100">{claim.text}</p>
      </div>

      {(claim.entities.length > 0 || claim.locations.length > 0 || claim.dates.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {claim.entities.map((e, i) => (
            <span key={i} className={`rounded-md border px-2 py-0.5 text-xs ${CHIP[e.type]}`}>
              {e.name}
              <span className="ml-1 opacity-60">{e.type}</span>
            </span>
          ))}
          {claim.locations.map((l, i) => (
            <span key={`l${i}`} className={`rounded-md border px-2 py-0.5 text-xs ${CHIP.location}`}>
              📍 {l}
            </span>
          ))}
          {claim.dates.map((d, i) => (
            <span key={`d${i}`} className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">
              🗓 {d}
            </span>
          ))}
        </div>
      )}

      <div className="border-t border-zinc-800 pt-3">
        {sources === undefined ? (
          <p className="animate-pulse text-xs text-zinc-500">Retrieving sources…</p>
        ) : (
          <>
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              {sources.length} source{sources.length === 1 ? "" : "s"} retrieved
            </p>
            {warning && <p className="mb-2 text-xs text-red-400">{warning}</p>}
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.id} className="text-xs">
                  <div className="text-zinc-500">
                    {s.outlet}
                    {s.publishDate ? ` · ${s.publishDate}` : ""}
                    {s.author ? ` · ${s.author}` : ""}
                  </div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-zinc-200 hover:text-amber-400"
                  >
                    {s.title}
                  </a>
                  {s.snippet && <p className="mt-0.5 text-zinc-400">{s.snippet}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}
