import type { Source } from "@/lib/types";
import SourceCard from "@/components/SourceCard";

export default function NarrativeView({ sources }: { sources: Source[] }) {
  const supporting = sources.filter((s) => s.stance === "supports");
  const conflicting = sources.filter((s) => s.stance === "conflicts");
  const neutral     = sources.filter((s) => s.stance === "neutral" || !s.stance);

  const col = (label: string, items: Source[], color: string, empty: string) => (
    <div className="flex-1 min-w-0 space-y-2">
      <p className={`text-xs font-semibold uppercase tracking-wide ${color}`}>
        {label} <span className="opacity-60">({items.length})</span>
      </p>
      {items.length === 0
        ? <p className="text-xs text-zinc-600 italic">{empty}</p>
        : items.map((s) => <SourceCard key={s.id} source={s} />)
      }
    </div>
  );

  return (
    <div className="flex gap-4 items-start">
      {col("Supporting", supporting, "text-emerald-400", "No supporting sources")}
      {col("Conflicting", conflicting, "text-red-400",     "No conflicting sources")}
      {col("Neutral", neutral,     "text-zinc-500",    "No neutral sources")}
    </div>
  );
}
