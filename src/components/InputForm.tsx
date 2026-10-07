"use client";
import { useState } from "react";

export default function InputForm({
  onSubmit,
  loading,
}: {
  onSubmit: (input: string) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        autoComplete="off"
        placeholder="Paste a news URL or type a claim to investigate…"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500"
      />
      <button
        suppressHydrationWarning
        onClick={() => onSubmit(value.trim())}
        disabled={loading || value.trim().length < 8}
        className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Investigating…" : "Investigate"}
      </button>
    </div>
  );
}
