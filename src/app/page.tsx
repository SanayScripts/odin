"use client";
import { useState } from "react";
import InputForm from "@/components/InputForm";
import PipelineProgress, { type StageStatus } from "@/components/PipelineProgress";
import ClaimCard from "@/components/ClaimCard";
import VerdictPanel from "@/components/VerdictPanel";
import NarrativeView from "@/components/NarrativeView";
import Timeline from "@/components/Timeline";
import { generateMarkdownReport } from "@/lib/report";
import { STAGES, type Claim, type Source, type ClaimResult, type Verdict, type SSEEvent, type Stage } from "@/lib/types";

type ArticleMeta = { title: string | null; outlet: string | null; author: string | null; publishDate: string | null; url: string | null; chars: number };
const idle = () => Object.fromEntries(STAGES.map((s) => [s, "idle"])) as Record<Stage, StageStatus>;

export default function Home() {
  const [statuses, setStatuses] = useState<Record<Stage, StageStatus>>(idle());
  const [mode, setMode] = useState<"url" | "text" | null>(null);
  const [article, setArticle] = useState<ArticleMeta | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [sources, setSources] = useState<Record<string, Source[]>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [results, setResults] = useState<ClaimResult[]>([]);
  const [overall, setOverall] = useState<{ verdict: Verdict; confidence: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"claims" | "narrative" | "timeline">("claims");
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  function handle(ev: SSEEvent) {
    if (ev.type === "stage") {
      setStatuses((p) => ({ ...p, [ev.stage]: ev.status === "start" ? "active" : "done" }));
    } else if (ev.type === "data") {
      const p = ev.payload as Record<string, unknown>;
      if (ev.stage === "INGEST") { setMode(p.mode as "url" | "text"); setArticle(p.article as ArticleMeta); }
      else if (ev.stage === "EXTRACT") { setClaims(p.claims as Claim[]); }
      else if (ev.stage === "RETRIEVE") {
        const id = p.claimId as string;
        setSources((s) => ({ ...s, [id]: p.sources as Source[] }));
        if (p.warning) setWarnings((w) => ({ ...w, [id]: p.warning as string }));
      } else if (ev.stage === "CLASSIFY") {
        const id = p.claimId as string;
        setSources((s) => ({ ...s, [id]: p.sources as Source[] }));
      } else if (ev.stage === "PROVENANCE") {
        const all = p.sources as Source[];
        setSources(() => {
          const m: Record<string, Source[]> = {};
          for (const s of all) { m[s.claimId] = [...(m[s.claimId] ?? []), s]; }
          return m;
        });
      } else if (ev.stage === "SCORE") {
        setResults(p.results as ClaimResult[]);
        setOverall({ verdict: p.overall as Verdict, confidence: p.overallConfidence as number });
      }
    } else {
      setError(ev.message);
      setStatuses((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === "active" ? "idle" : v])) as Record<Stage, StageStatus>);
    }
  }

  async function run(value: string) {
    setInput(value);
    setLoading(true); setError(null); setMode(null); setArticle(null);
    setClaims([]); setSources({}); setWarnings({}); setResults([]); setOverall(null);
    setStatuses(idle()); setActiveTab("claims"); setCopied(false);
    try {
      const res = await fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: value }) });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Request failed (${res.status})`); }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buf += dec.decode(chunk, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) { if (part.startsWith("data: ")) handle(JSON.parse(part.slice(6)) as SSEEvent); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setLoading(false); }
  }

  const allSources = Object.values(sources).flat();
  const resultMap = Object.fromEntries(results.map((r) => [r.claimId, r]));
  const TABS = ["claims", "narrative", "timeline"] as const;
  const TAB_LABEL: Record<typeof TABS[number], string> = { claims: "Claims", narrative: "Narrative", timeline: "Timeline" };
  const isDone = statuses["DONE"] === "done";

  function handleExport() {
    if (!overall) return;
    const md = generateMarkdownReport({ input, claims, sources: allSources, results, overall: overall.verdict, overallConfidence: overall.confidence });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "odin-report.md"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (!overall) return;
    const md = generateMarkdownReport({ input, claims, sources: allSources, results, overall: overall.verdict, overallConfidence: overall.confidence });
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <header>
        <h1 className="text-4xl font-bold tracking-tight"><span className="text-amber-500">ᚦ</span> Odin</h1>
        <p className="mt-2 text-sm text-zinc-400">OSINT news verification — provenance, corroboration, conflict.</p>
      </header>

      <InputForm onSubmit={run} loading={loading} />
      <PipelineProgress statuses={statuses} />

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950 p-4 text-sm text-red-300 space-y-1">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {overall && <VerdictPanel overall={overall.verdict} confidence={overall.confidence} results={results} />}

      {isDone && overall && (
        <div className="flex gap-2">
          <button onClick={handleCopy} className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition">
            {copied ? "Copied!" : "Copy report"}
          </button>
          <button onClick={handleExport} className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition">
            Download .md
          </button>
        </div>
      )}

      {mode && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
          <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{mode === "url" ? "Source article" : "Submitted claim"}</p>
          {mode === "url" && article
            ? <><p className="font-medium text-zinc-100">{article.title ?? article.url}</p><p className="text-xs text-zinc-500">{[article.outlet, article.publishDate, article.author].filter(Boolean).join(" · ")}</p></>
            : <p className="text-zinc-400">Analyzing submitted text as the origin.</p>}
        </section>
      )}

      {claims.length > 0 && (
        <section className="space-y-4">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${activeTab === t ? "bg-amber-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>

          {activeTab === "claims" && (
            <div className="space-y-4">
              {claims.map((c, i) => (
                <ClaimCard key={c.id} index={i} claim={c} sources={sources[c.id]} warning={warnings[c.id]} result={resultMap[c.id]} />
              ))}
            </div>
          )}
          {activeTab === "narrative" && <NarrativeView sources={allSources} />}
          {activeTab === "timeline" && <Timeline sources={allSources} />}
        </section>
      )}

      <footer className="border-t border-zinc-800 pt-6 text-xs text-zinc-600">
        Odin provides automated OSINT analysis. Results may be incomplete or incorrect — verify independently before acting on any finding.
      </footer>
    </main>
  );
}
