"use client";
import { useState } from "react";
import InputForm from "@/components/InputForm";
import PipelineProgress, { type StageStatus } from "@/components/PipelineProgress";
import { STAGES, type SSEEvent, type Stage } from "@/lib/types";

const idle = () =>
  Object.fromEntries(STAGES.map((s) => [s, "idle"])) as Record<Stage, StageStatus>;

export default function Home() {
  const [statuses, setStatuses] = useState<Record<Stage, StageStatus>>(idle());
  const [payloads, setPayloads] = useState<Partial<Record<Stage, unknown>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handle(ev: SSEEvent) {
    if (ev.type === "stage") {
      setStatuses((p) => ({ ...p, [ev.stage]: ev.status === "start" ? "active" : "done" }));
    } else if (ev.type === "data") {
      setPayloads((p) => ({ ...p, [ev.stage]: ev.payload }));
    } else {
      setError(ev.message);
    }
  }

  async function run(input: string) {
    setLoading(true);
    setError(null);
    setPayloads({});
    setStatuses(idle());
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (part.startsWith("data: ")) handle(JSON.parse(part.slice(6)) as SSEEvent);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <header>
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-amber-500">ᚦ</span> Odin
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          OSINT news verification — provenance, corroboration, conflict.
        </p>
      </header>

      <InputForm onSubmit={run} loading={loading} />
      <PipelineProgress statuses={statuses} />

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {Object.keys(payloads).length > 0 && (
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-400">
          {JSON.stringify(payloads, null, 2)}
        </pre>
      )}
    </main>
  );
}
