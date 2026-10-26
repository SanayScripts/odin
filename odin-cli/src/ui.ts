import type { Claim, ClaimResult, Source, Verdict } from "@/lib/types";
import type { DomainProfile } from "@/lib/kali";

const e = (n: string) => (s: string) => `\x1b[${n}m${s}\x1b[0m`;
export const dim = e("2"), red = e("31"), grn = e("32"), ylw = e("33"), cyn = e("36"), bold = e("1"), gry = e("90");
const tty = !!process.stdout.isTTY;
const W = () => Math.max(60, Math.min(process.stdout.columns || 90, 100));
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(0, n - 1)) + "…" : s);
const bar = (f: number, n = 20) => { const k = Math.round(Math.max(0, Math.min(1, f)) * n); return "█".repeat(k) + "░".repeat(n - k); };
const FR = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const sec = (ms: number) => (ms / 1000).toFixed(1) + "s";

export function banner() {
  console.log(`\n  ${cyn("◆")} ${bold("ODIN")}  ${dim("OSINT news verification")}\n  ${dim("─".repeat(Math.min(48, W() - 4)))}`);
}

type Row = { id: string; tool: string; state: "wait" | "run" | "done" | "fail"; detail: string; t0: number; t1: number };

/** Live stage rail: spinner + per-stage timer + live detail. Redraws in place, so it never looks stuck. */
export class Rail {
  rows: Row[];
  frame = 0;
  timer?: NodeJS.Timeout;
  printed = 0;
  constructor(stages: [string, string][]) {
    this.rows = stages.map(([id, tool]) => ({ id, tool, state: "wait", detail: "", t0: 0, t1: 0 }));
    process.on("exit", () => tty && process.stdout.write("\x1b[?25h"));
  }
  private row(id: string) { return this.rows.find((r) => r.id === id)!; }
  start(id: string, detail = "") {
    const r = this.row(id);
    Object.assign(r, { state: "run", detail, t0: Date.now() });
    if (!tty) console.log(`▸ ${id} ${detail}`);
    else if (!this.timer) { process.stdout.write("\x1b[?25l"); this.timer = setInterval(() => { this.frame++; this.draw(); }, 80); }
    this.draw();
  }
  set(id: string, detail: string) { this.row(id).detail = detail; }
  done(id: string, detail?: string) {
    const r = this.row(id);
    r.state = "done"; r.t1 = Date.now();
    if (detail !== undefined) r.detail = detail;
    if (!tty) console.log(`✔ ${id} ${r.detail}`);
    this.draw();
  }
  fail(id: string, detail: string) {
    const r = this.row(id);
    r.state = "fail"; r.t1 = Date.now(); r.detail = detail;
    this.draw();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.draw();
    if (tty) process.stdout.write("\x1b[?25h");
  }
  private draw() {
    if (!tty) return;
    const total = this.rows.length;
    const done = this.rows.filter((r) => r.state === "done").length;
    const lines = this.rows.map((r) => {
      const t = r.state === "run" ? sec(Date.now() - r.t0) : r.state === "wait" ? "" : sec(r.t1 - r.t0);
      const icon = r.state === "done" ? grn("✔") : r.state === "fail" ? red("✖") : r.state === "run" ? cyn(FR[this.frame % FR.length]) : gry("○");
      const label = r.state === "wait" ? gry(r.id.padEnd(11)) : r.state === "run" ? bold(r.id.padEnd(11)) : r.id.padEnd(11);
      const room = Math.max(10, W() - 52);
      const detail = r.state === "fail" ? red(cut(r.detail, room)) : r.state === "run" ? cut(r.detail, room) + dim(".".repeat(this.frame % 4)) : dim(cut(r.detail, room));
      return `  ${icon} ${label} ${dim(r.tool.padEnd(19))} ${dim(t.padStart(6))}  ${detail}`;
    });
    const filled = Math.round(((done + (this.rows.some((r) => r.state === "run") ? 0.5 : 0)) / total) * 28);
    const pulse = this.frame % 2 ? "▸" : "▹";
    lines.push("", `  ${cyn("━".repeat(filled))}${filled < 28 ? cyn(pulse) : ""}${gry("─".repeat(Math.max(0, 27 - filled)))} ${dim(`${done}/${total}`)}`);
    let out = this.printed ? `\x1b[${this.printed}A` : "";
    for (const l of lines) out += `\x1b[2K\r${l}\n`;
    this.printed = lines.length;
    process.stdout.write(out);
  }
}

const dots = (t: number) => "●".repeat(t) + "○".repeat(5 - t);
const verdictText = (v: Verdict, r?: Pick<ClaimResult, "support" | "conflict">) => {
  if (v === "supported") return grn("✓ SUPPORTED");
  if (v === "insufficient") return ylw("? INSUFFICIENT EVIDENCE");
  const ratio = r && r.support + r.conflict > 0 ? r.support / (r.support + r.conflict) : 0.5;
  return red(ratio <= 0.35 ? "✗ CONTESTED · LEANING FALSE" : ratio >= 0.65 ? "✗ CONTESTED · LEANING TRUE" : "✗ CONTESTED");
};

export function renderReport(a: {
  claims: Claim[]; sources: Source[]; results: ClaimResult[]; overall: Verdict; overallConfidence: number;
  recon?: Map<string, DomainProfile>; bias?: { outlet: string; dominantStance: string; count: number }[];
}) {
  const w = Math.min(W() - 4, 78);
  const chains = new Set(a.sources.map((s) => s.chainId).filter(Boolean)).size;
  const lean = a.results.reduce((acc, r) => ({ s: acc.s + r.support, c: acc.c + r.conflict }), { s: 0, c: 0 });
  const label = verdictText(a.overall, { support: lean.s, conflict: lean.c });
  console.log("");
  console.log(`  ${dim("╭" + "─".repeat(w))}`);
  console.log(`  ${dim("│")}  ${bold("VERDICT")}  ${label}`);
  console.log(`  ${dim("│")}  ${dim("confidence")} ${cyn(bar(a.overallConfidence, 24))} ${bold(Math.round(a.overallConfidence * 100) + "%")}   ${dim(`${a.sources.length} sources · ${chains} reporting chains · ${a.claims.length} claim${a.claims.length > 1 ? "s" : ""}`)}`);
  console.log(`  ${dim("╰" + "─".repeat(w))}`);

  const byId = new Map(a.sources.map((s) => [s.id, s]));
  a.claims.forEach((cl, i) => {
    const r = a.results[i];
    const tot = r.support + r.conflict;
    console.log(`\n  ${bold(`C${i + 1}`)}  ${cut(cl.text, w - 6)}`);
    console.log(`      ${verdictText(r.verdict, r)}  ${dim(`${Math.round(r.confidence * 100)}% · ${r.independentChains} independent chain${r.independentChains === 1 ? "" : "s"}`)}`);
    console.log(`      ${grn("▲")} ${grn(bar(tot ? r.support / tot : 0, 16))} ${red(bar(tot ? r.conflict / tot : 0, 16))} ${red("▼")}  ${dim(`support ${r.support.toFixed(2)} · conflict ${r.conflict.toFixed(2)}`)}`);
    const rows = a.sources.filter((s) => s.claimId === cl.id).sort((x, y) => (x.publishDate ?? "9999").localeCompare(y.publishDate ?? "9999"));
    for (const s of rows) {
      const st = s.stance === "supports" ? grn("SUP") : s.stance === "conflicts" ? red("CON") : gry("NEU");
      const cited = s.citesSourceId ? byId.get(s.citesSourceId)?.outlet : null;
      const tag = [s.isOriginal ? ylw("ORIGINAL") : "", cited ? dim(`↳ cites ${cited}`) : "", s.geoMismatch ? red("GEO?") : ""].filter(Boolean).join(" ");
      console.log(`      ${st} ${cyn(dots(s.tier ?? 1))} ${cut(s.outlet, 24).padEnd(24)} ${dim((s.publishDate ?? "undated").padEnd(10))} ${tag}`);
    }
  });

  if (a.recon?.size) {
    console.log(`\n  ${bold("RECON")} ${dim("whois · dig · whatweb")}`);
    for (const [d, p] of a.recon) {
      const age = p.ageDays != null ? `${Math.round(p.ageDays / 365)}y` : "n/a";
      console.log(`      ${cut(d, 24).padEnd(24)} ${dim(`age ${age.padEnd(4)} ips ${p.ips}  ${cut(p.stack ?? "whatweb n/a", w - 44)}`)}${p.ageDays != null && p.ageDays < 180 ? red("  NEW DOMAIN") : ""}`);
    }
  }
  for (const p of a.bias ?? []) console.log(`\n  ${ylw("⚑")} ${p.outlet} took "${p.dominantStance}" in ${p.count} sources`);
  console.log(`\n  ${dim("automated analysis; verify independently")}`);
}
