import { STAGES, type Stage } from "@/lib/types";

export type StageStatus = "idle" | "active" | "done";

const LABELS: Record<Stage, string> = {
  INGEST: "Ingest",
  EXTRACT: "Extract claims",
  RETRIEVE: "Retrieve sources",
  CLASSIFY: "Classify stance",
  PROVENANCE: "Trace provenance",
  SCORE: "Score & verdict",
  DONE: "Complete",
};

export default function PipelineProgress({
  statuses,
}: {
  statuses: Record<Stage, StageStatus>;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STAGES.map((s) => {
        const st = statuses[s];
        const style =
          st === "done"
            ? "border-emerald-700 bg-emerald-950 text-emerald-300"
            : st === "active"
            ? "animate-pulse border-amber-500 bg-amber-950 text-amber-300"
            : "border-zinc-800 bg-zinc-900 text-zinc-500";
        return (
          <li key={s} className={`rounded-full border px-3 py-1 text-xs font-medium ${style}`}>
            {LABELS[s]}
          </li>
        );
      })}
    </ol>
  );
}
