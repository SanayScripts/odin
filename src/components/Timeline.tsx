import type { Source } from "@/lib/types";

const STANCE_DOT: Record<string, string> = {
  supports: "bg-emerald-400",
  conflicts: "bg-red-400",
  neutral:   "bg-zinc-500",
};

export default function Timeline({ sources }: { sources: Source[] }) {
  const dated = sources
    .filter((s) => s.publishDate)
    .sort((a, b) => a.publishDate!.localeCompare(b.publishDate!));

  if (dated.length === 0) return null;

  const first = dated[0].publishDate!;
  const last  = dated[dated.length - 1].publishDate!;
  const span  = Math.max(1, new Date(last).getTime() - new Date(first).getTime());

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Timeline</p>
      <div className="relative ml-2">
        <div className="absolute left-1.5 top-0 bottom-0 w-px bg-zinc-800" />
        <ul className="space-y-3">
          {dated.map((s) => {
            const offset = (new Date(s.publishDate!).getTime() - new Date(first).getTime()) / span;
            const dot = STANCE_DOT[s.stance ?? "neutral"] ?? STANCE_DOT.neutral;
            const lagDays = Math.round(
              (new Date(s.publishDate!).getTime() - new Date(first).getTime()) / 86400000
            );
            return (
              <li key={s.id} className="flex gap-3 items-start pl-5 relative">
                <span className={`absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${dot}`} />
                <div className="min-w-0">
                  <a href={s.url} target="_blank" rel="noreferrer"
                    className="text-xs font-medium text-zinc-200 hover:text-amber-400 truncate block max-w-xs">
                    {s.title}
                  </a>
                  <p className="text-xs text-zinc-500">
                    {s.outlet} · {s.publishDate}
                    {s.isOriginal && <span className="ml-1 text-amber-400">· First report</span>}
                    {lagDays > 0 && <span className="ml-1 text-zinc-600">+{lagDays}d</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
