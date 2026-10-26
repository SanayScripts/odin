import { writeFileSync } from "node:fs";
import readline from "node:readline/promises";
import { ingest, extractClaims, retrieveSources, classifySources, mapPool, hostOf } from "@/lib/pipeline";
import { analyzeProvenance } from "@/lib/provenance";
import { flagGeoMismatches } from "@/lib/geo";
import { scoreCliam, aggregateVerdict } from "@/lib/scoring";
import { detectOutletBias } from "@/lib/credibility";
import { generateMarkdownReport } from "@/lib/report";
import { friendlyError } from "@/lib/groq";
import { profileDomain, waybackFirst, outboundLinks, linkEdges, type DomainProfile } from "@/lib/kali";
import type { Claim, Source } from "@/lib/types";
import { Rail, banner, renderReport, dim, red, ylw, cyn, bold } from "@/ui";
import { findFixture, scoreFixture, playDemo } from "@/demo";

const BOOST: Record<string, number> = { "who.int": 5, "paho.org": 5, "news.un.org": 5, "pmc.ncbi.nlm.nih.gov": 5, "nejm.org": 4, "pbs.org": 4, "kff.org": 3, "thelancet.com": 4, "ajtmh.org": 3 };
const STAGES: [string, string][] = [["INGEST", "curl"], ["EXTRACT", "groq"], ["RETRIEVE", "tavily"], ["RECON", "whois dig whatweb"], ["CLASSIFY", "groq"], ["PROVENANCE", "curl link graph"], ["SCORE", "local"]];
const args = process.argv.slice(2);
const outPath = args.includes("--out") ? args[args.indexOf("--out") + 1] : "report.md";

async function ask(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n  ${bold("Paste a news URL or type a claim to verify")}\n  ${dim("e.g. https://… or \"The WHO declared mpox a global health emergency\"")}\n`);
  const a = await rl.question(`  ${cyn("›")} `);
  rl.close();
  return a.trim();
}

async function recon(domain: string) {
  banner();
  const rail = new Rail([["RECON", "whois dig whatweb harvester"]]);
  rail.start("RECON", domain);
  const p = await profileDomain(domain, true);
  rail.done("RECON", "done");
  rail.stop();
  console.log(p);
  if (p.harvested) console.log(dim(p.harvested));
}

async function main() {
  if (args[0] === "recon" && args[1]) return recon(args[1]);
  banner();
  const input = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out").join(" ").trim() || (await ask());
  if (input.length < 8) return console.log(red("\n  Enter a URL or a claim (min 8 chars)."));
  console.log("");

  const rail = new Rail(STAGES);
  const fx = findFixture(input);
  if (fx) {
    await playDemo(rail, fx);
    rail.stop();
    const { results, overall, overallConfidence } = scoreFixture(fx);
    renderReport({ claims: fx.claims, sources: fx.sources, results, overall, overallConfidence });
    writeFileSync(outPath, "> Demo fixture: offline sample data, not a live analysis.\n\n" + generateMarkdownReport({ input, claims: fx.claims, sources: fx.sources, results, overall, overallConfidence }));
    return console.log(dim(`  report written to ${outPath}\n`));
  }

  const warns: string[] = [];
  let cur = "INGEST";
  try {
    rail.start("INGEST", "fetching with curl");
    const { article } = await ingest(input);
    rail.done("INGEST", article.title ? article.title.slice(0, 60) : "text claim");

    cur = "EXTRACT"; rail.start("EXTRACT", "reading article, finding claims");
    const claims: Claim[] = await extractClaims(article);
    rail.done("EXTRACT", `${claims.length} claim${claims.length > 1 ? "s" : ""} extracted`);

    cur = "RETRIEVE"; rail.start("RETRIEVE", `searching, claim 1/${claims.length}`);
    let sources: Source[] = [], k = 0;
    await mapPool(claims, 2, async (cl) => {
      try { sources.push(...(await retrieveSources(cl, article))); } catch (e) { warns.push(`${cl.id}: ${friendlyError(e)}`); }
      rail.set("RETRIEVE", `${++k}/${claims.length} claims · ${sources.length} sources`);
    });
    if (!sources.length) { rail.fail("RETRIEVE", "no sources found"); rail.stop(); return console.log(ylw("\n  No sources found. Verdict: ? Insufficient Evidence\n")); }
    rail.done("RETRIEVE", `${sources.length} sources`);

    cur = "RECON"; rail.start("RECON", "whois · dig · whatweb");
    const domains = [...new Set(sources.map((s) => s.outlet))];
    const profiles = new Map<string, DomainProfile>();
    await mapPool(domains, 4, async (d) => { profiles.set(d, await profileDomain(d)); rail.set("RECON", `${profiles.size}/${domains.length} domains profiled`); });
    const undated = sources.filter((s) => !s.publishDate), wb = new Map<string, string | null>();
    await mapPool(undated, 4, async (s) => { wb.set(s.id, await waybackFirst(s.url)); rail.set("RECON", `wayback dates ${wb.size}/${undated.length}`); });
    sources = sources.map((s) => {
      const p = profiles.get(s.outlet), young = p?.ageDays != null && p.ageDays < 180;
      return { ...s, tier: young ? 1 : Math.max(s.tier ?? 0, BOOST[s.outlet] ?? 0), publishDate: s.publishDate ?? wb.get(s.id) ?? null };
    });
    rail.done("RECON", `${domains.length} domains profiled`);

    cur = "CLASSIFY"; rail.start("CLASSIFY", `classifying stance, claim 1/${claims.length}`);
    const byClaim = new Map<string, Source[]>();
    await mapPool(claims, 2, async (cl) => {
      const group = sources.filter((s) => s.claimId === cl.id);
      try { byClaim.set(cl.id, await classifySources(cl, group)); } catch (e) { warns.push(`${cl.id}: ${friendlyError(e)}`); byClaim.set(cl.id, group); }
      rail.set("CLASSIFY", `${byClaim.size}/${claims.length} claims classified`);
    });
    sources = claims.flatMap((cl) => byClaim.get(cl.id) ?? []);
    rail.done("CLASSIFY", "stances assigned");

    cur = "PROVENANCE"; rail.start("PROVENANCE", "ordering by date");
    sources = flagGeoMismatches(claims, analyzeProvenance(sources));
    const links = new Map<string, string[]>();
    await mapPool(sources, 4, async (s) => { links.set(s.id, await outboundLinks(s.url)); rail.set("PROVENANCE", `curl link graph ${links.size}/${sources.length}`); });
    sources = linkEdges(sources, links, hostOf);
    rail.done("PROVENANCE", "original + citation chains found");

    cur = "SCORE"; rail.start("SCORE", "tier × confidence × independence");
    const results = claims.map((cl) => scoreCliam(cl.id, sources));
    const { overall, overallConfidence } = aggregateVerdict(results);
    rail.done("SCORE", "verdicts computed");
    rail.stop();

    renderReport({ claims, sources, results, overall, overallConfidence, recon: profiles, bias: detectOutletBias(sources) });
    warns.forEach((w) => console.log(red(`  ! ${w}`)));
    writeFileSync(outPath, generateMarkdownReport({ input, claims, sources, results, overall, overallConfidence }));
    console.log(dim(`  report written to ${outPath}\n`));
  } catch (e) {
    rail.fail(cur, friendlyError(e));
    rail.stop();
    console.log(red(`\n  ${friendlyError(e)}\n`));
    process.exit(1);
  }
}

main().catch((e) => { console.error(red(friendlyError(e))); process.exit(1); });
