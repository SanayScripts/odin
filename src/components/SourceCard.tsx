import type { Source } from "@/lib/types";

const STANCE_STYLE: Record<string, string> = {
  supports: "bg-emerald-900 text-emerald-300 border-emerald-700",
  conflicts: "bg-red-900 text-red-300 border-red-700",
  neutral:   "bg-zinc-800 text-zinc-400 border-zinc-600",
};

const TIER_LABEL: Record<number, string> = { 5: "Wire", 4: "Major", 3: "Regional", 2: "Aggregator", 1: "Blog" };
const TIER_COLOR: Record<number, string> = {
  5: "bg-violet-900 text-violet-300",
  4: "bg-sky-900 text-sky-300",
  3: "bg-blue-900 text-blue-300",
  2: "bg-zinc-800 text-zinc-400",
  1: "bg-zinc-900 text-zinc-500",
};

export default function SourceCard({ source }: { source: Source }) {
  const tier = source.tier ?? 1;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TIER_COLOR[tier]}`}>
          {TIER_LABEL[tier] ?? `T${tier}`}
        </span>
        {source.stance && (
          <span className={`rounded border px-1.5 py-0.5 text-xs font-semibold ${STANCE_STYLE[source.stance]}`}>
            {source.stance}{source.stanceConfidence != null ? ` ${Math.round(source.stanceConfidence * 100)}%` : ""}
          </span>
        )}
        {source.isOriginal && (
          <span className="rounded px-1.5 py-0.5 text-xs bg-amber-900 text-amber-300 font-medium">Original</span>
        )}
        {source.citesSourceId && (
          <span className="rounded px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-400">Secondary</span>
        )}
        {source.geoMismatch && (
          <span className="rounded px-1.5 py-0.5 text-xs bg-orange-900 text-orange-300">Geo mismatch</span>
        )}
      </div>
      <div>
        <a href={source.url} target="_blank" rel="noreferrer"
          className="text-xs font-medium text-zinc-200 hover:text-amber-400 leading-snug block">
          {source.title}
        </a>
        <p className="text-xs text-zinc-500 mt-0.5">
          {source.outlet}{source.publishDate ? ` · ${source.publishDate}` : ""}{source.author ? ` · ${source.author}` : ""}
        </p>
      </div>
      {source.snippet && <p className="text-xs text-zinc-400 line-clamp-2">{source.snippet}</p>}
    </div>
  );
}
