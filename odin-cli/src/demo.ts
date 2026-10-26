import type { Claim, Source } from "@/lib/types";
import { scoreCliam, aggregateVerdict } from "@/lib/scoring";
import type { Rail } from "@/ui";

// Hardcoded offline fixtures for demoing a TRUE and a FALSE case. Dates for the lemon tea set are approximate.
type St = "supports" | "conflicts" | "neutral";
type Spec = { key: string; url: string; title: string; outlet: string; date: string; tier: number; cites?: string };
export type Fixture = { kind: "url" | "text"; claims: Claim[]; sources: Source[] };

function build(claimId: string, specs: Spec[], stances: St[]): Source[] {
  const id = (k: string) => `${claimId}-${k}`;
  const chain = new Map<string, string>();
  specs.forEach((sp) => chain.set(sp.key, sp.cites ? chain.get(sp.cites)! : id(sp.key)));
  const first = [...specs].sort((a, b) => a.date.localeCompare(b.date))[0].key;
  return specs.map((sp, i) => ({
    id: id(sp.key), claimId, url: sp.url, title: sp.title, outlet: sp.outlet, publishDate: sp.date, author: null,
    tier: sp.tier, stance: stances[i], stanceConfidence: stances[i] === "neutral" ? 0.5 : 0.9,
    isOriginal: sp.key === first, citesSourceId: sp.cites ? id(sp.cites) : null, chainId: chain.get(sp.key)!, geoMismatch: false,
  }));
}

const REUTERS_URL = "https://www.reuters.com/world/ukraine-russia-war/russia-builds-major-new-drone-attack-base-six-weeks-satellite-images-show-2026-10-15/";
const loc = ["Millerovo", "Rostov Oblast", "Russia"];
const rClaims: Claim[] = [
  { id: "c1", text: "Russia has nearly finished building a major new launch base for jet-powered drones in about six weeks.", entities: [{ name: "Russia", type: "location" }, { name: "Reuters", type: "org" }], dates: ["2026-10-15"], locations: loc },
  { id: "c2", text: "The new drone launch site lies about 3.5 km from Russia's Millerovo air base in Rostov Oblast.", entities: [{ name: "Millerovo air base", type: "location" }], dates: [], locations: loc },
  { id: "c3", text: "DroneSec estimates the new base could launch 100 or more jet-powered drones within 24 hours.", entities: [{ name: "DroneSec", type: "org" }, { name: "Mike Monnik", type: "person" }], dates: [], locations: loc },
];
const rSpecs: Spec[] = [
  { key: "reuters", url: REUTERS_URL, title: "Russia builds major new drone attack base in six weeks, satellite images show", outlet: "reuters.com", date: "2026-10-15", tier: 5 },
  { key: "ki", url: "https://kyivindependent.com/ukrainian-drones-reportedly-hit-sberbank-data-center-in-russia", title: "Kyiv Independent report citing ARS OSINT satellite analysis (Oct. 13)", outlet: "kyivindependent.com", date: "2026-10-14", tier: 4 },
  { key: "yahoo", url: "https://www.yahoo.com/news/world/articles/russia-builds-massive-launch-jet-164107979.html", title: "Russia builds massive new launch base for jet-powered attack drones in six weeks", outlet: "yahoo.com", date: "2026-10-15", tier: 3, cites: "ki" },
  { key: "brec", url: "https://www.brecorder.com/news/40444384/russia-builds-major-new-drone-attack-base-in-six-weeks-satellite-images-show", title: "Russia builds major new drone attack base in six weeks, satellite images show", outlet: "brecorder.com", date: "2026-10-15", tier: 3, cites: "reuters" },
  { key: "newsmax", url: "https://www.newsmax.com/world/globaltalk/russia-drone-attack-base-satellite-images/2026/10/15/id/1272865/", title: "Russia Builds Major New Drone Attack Base in Six Weeks, Satellite Images Show", outlet: "newsmax.com", date: "2026-10-15", tier: 3, cites: "reuters" },
  { key: "moddip", url: "https://moderndiplomacy.eu/2026/10/15/satellite-images-reveal-russia-built-major-new-drone-attack-base-in-just-six-weeks/", title: "Satellite Images Reveal Russia Built Major New Drone Attack Base in Just Six Weeks", outlet: "moderndiplomacy.eu", date: "2026-10-15", tier: 2, cites: "reuters" },
  { key: "u24", url: "https://united24media.com/world/russias-new-drone-base-could-launch-over-100-jet-powered-drones-daily-expert-warns-23476", title: "Russia's New Drone Base Could Launch Over 100 Jet-Powered Drones Daily, Expert Warns", outlet: "united24media.com", date: "2026-10-15", tier: 3, cites: "reuters" },
];
const S: St = "supports", N: St = "neutral";
const reuters: Fixture = {
  kind: "url", claims: rClaims,
  sources: [
    ...build("c1", rSpecs, [S, S, S, S, S, S, S]),
    ...build("c2", rSpecs, [S, N, N, N, S, S, N]),
    ...build("c3", rSpecs, [S, N, S, N, N, S, S]),
  ],
};

const lemon: Fixture = {
  kind: "text",
  claims: [{ id: "c1", text: "Lemon tea cures COVID-19.", entities: [{ name: "lemon tea", type: "other" }, { name: "COVID-19", type: "other" }], dates: [], locations: [] }],
  sources: build("c1", [
    { key: "who", url: "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters", title: "Coronavirus disease (COVID-19) advice for the public: Myth busters", outlet: "who.int", date: "2020-03-24", tier: 5 },
    { key: "boom", url: "https://boomlive.in/coronavirus-outbreak/false-different-types-of-tea-can-act-as-a-cure-for-covid-19-7506", title: "False: different types of tea can act as a cure for COVID-19", outlet: "boomlive.in", date: "2020-03-28", tier: 3 },
    { key: "morung", url: "https://morungexpress.com/can-tea-or-water-cure-does-lemon-or-turmeric-prevent-covid-19-myths-busted", title: "Can tea or water cure? Does lemon or turmeric prevent?: COVID-19 myths busted", outlet: "morungexpress.com", date: "2020-03-26", tier: 2, cites: "who" },
    { key: "fc", url: "https://www.factcheck.org/2020/04/lemon-juice-tea-does-not-cure-covid-19-in-israel-or-anywhere-else/", title: "Lemon Juice Tea Does Not Cure COVID-19 in Israel, or Anywhere Else", outlet: "factcheck.org", date: "2020-04-03", tier: 4 },
    { key: "it", url: "http://www.indiatoday.in/fact-check/story/mixing-lemon-baking-soda-tea-wont-kill-coronavirus-1687315-2020-06-09/", title: "Mixing lemon, baking soda in tea won't kill coronavirus", outlet: "indiatoday.in", date: "2020-06-09", tier: 4 },
    { key: "aap", url: "https://www.aap.com.au/factcheck/covid-hot-tea-cure-of-lemon-and-bicarb-doesnt-hold-water/", title: "COVID 'hot tea' cure of lemon and bicarb doesn't hold water", outlet: "aap.com.au", date: "2021-04-12", tier: 3, cites: "who" },
  ], ["conflicts", "conflicts", "conflicts", "conflicts", "conflicts", "conflicts"]),
};

const TOI_URL = "https://timesofindia.indiatimes.com/city/bhopal/soviet-era-blueprints-decoded-jabalpur-factory-builds-indigenous-tank-overhaul-capability-to-repair-t-72-and-t-90-battle-tanks-annually-from-april-2028-with-a-rs-462-crore-facility-to-dismantle-rebuild-and-test-the-armys-soviet-origin-armoured-fleet/articleshow/135200894.cms";
const jLoc = ["Jabalpur", "Madhya Pradesh"];
const jClaims: Claim[] = [
  { id: "c1", text: "Defence Minister Rajnath Singh laid the foundation stone for a ₹472-crore tank overhaul facility at Vehicle Factory Jabalpur.", entities: [{ name: "Rajnath Singh", type: "person" }, { name: "Vehicle Factory Jabalpur", type: "org" }], dates: ["2026-08-27"], locations: jLoc },
  { id: "c2", text: "The Jabalpur facility will overhaul 80 T-72 and T-90 tanks annually.", entities: [{ name: "Vehicle Factory Jabalpur", type: "org" }], dates: [], locations: jLoc },
  { id: "c3", text: "The Heavy Vehicles Factory at Avadi overhauls about 150 tanks a year.", entities: [{ name: "Heavy Vehicles Factory", type: "org" }], dates: [], locations: ["Avadi", "Tamil Nadu"] },
];
const jSpecs: Spec[] = [
  { key: "hawk", url: "https://www.thehawk.in/news/india/rajnath-singh-lays-foundation-stone-for-t-72-t-90-tank-overhaul-facility-in-jabalpur", title: "Rajnath Singh lays foundation stone for T-72, T-90 tank overhaul facility in Jabalpur", outlet: "thehawk.in", date: "2026-08-27", tier: 3 },
  { key: "week", url: "https://www.theweek.in/news/defence/2026/08/27/india-closes-tank-overhaul-gap-jabalpur-facility-to-add-capacity-for-80-t-72s-t-90s.html", title: "India closes tank overhaul gap: Jabalpur facility to add capacity for 80 T-72s, T-90s", outlet: "theweek.in", date: "2026-08-27", tier: 4 },
  { key: "raksha", url: "https://www.rakshasamachar.com/defence-news/rajnath-singh-t-72-t-90-tank-overhaul-project-jabalpur-indian-army/", title: "Rajnath Singh launches Rs 472 crore T-72 and T-90 tank overhaul project in Jabalpur", outlet: "rakshasamachar.com", date: "2026-08-27", tier: 2 },
  { key: "super", url: "https://superkalam.com/current-affairs/28-08-2026/rajnath-lays-foundation-for-tank-overhaul-facility-in-m-p-pg14-adf7d382-6206-4037-8522-92e1e862b313", title: "Rajnath lays foundation for tank overhaul facility in M.P.", outlet: "superkalam.com", date: "2026-08-28", tier: 2, cites: "hawk" },
  { key: "gulf", url: "https://www.pressreader.com/uae/gulf-news/20260828/281818585687031", title: "Rajnath lays foundation for tank overhaul facility in M.P.", outlet: "pressreader.com", date: "2026-08-28", tier: 4, cites: "hawk" },
  { key: "asian", url: "https://www.asianmilitaryreview.com/2026/09/india-enhances-overhaul-capacity-for-army-t-72-and-t-90-tanks-foc/", title: "India enhances overhaul capacity for army T-72 and T-90 tanks", outlet: "asianmilitaryreview.com", date: "2026-09", tier: 3 },
];
const jabalpur: Fixture = {
  kind: "url", claims: jClaims,
  sources: [
    ...build("c1", jSpecs, [S, S, S, S, S, S]),
    ...build("c2", jSpecs, [S, S, S, S, S, S]),
    ...build("c3", jSpecs, [S, S, N, S, N, S]),
  ],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\/+$/, "").replace(/[.!?\s]+$/, "");
export function findFixture(input: string): Fixture | null {
  const n = norm(input);
  if (n === norm(REUTERS_URL)) return reuters;
  if (n === norm(TOI_URL)) return jabalpur;
  if (n === "lemon tea cures covid" || n === "lemon tea cures covid-19") return lemon;
  return null;
}

export function scoreFixture(fx: Fixture) {
  const results = fx.claims.map((c) => scoreCliam(c.id, fx.sources));
  return { results, ...aggregateVerdict(results) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Plays the stage rail with realistic pacing so the demo looks like a live run. */
export async function playDemo(rail: Rail, fx: Fixture) {
  const n = fx.sources.length, doms = new Set(fx.sources.map((s) => s.outlet)).size, k = fx.claims.length;
  const plan: [string, string[], string][] = [
    ["INGEST", fx.kind === "url" ? ["resolving host", "curl · fetching article", "parsing title, date, outlet"] : ["plain-text claim detected"], fx.kind === "url" ? "article fetched via curl" : "text claim, no fetch needed"],
    ["EXTRACT", ["splitting into atomic claims", "tagging entities, dates, locations"], `${k} claim${k > 1 ? "s" : ""} extracted`],
    ["RETRIEVE", fx.claims.map((_, i) => `searching claim ${i + 1}/${k}`), `${n} sources retrieved`],
    ["RECON", ["whois · domain age", "dig · resolving hosts", "whatweb · fingerprinting stacks", "wayback · first captures"], `${doms} domains profiled`],
    ["CLASSIFY", fx.claims.map((_, i) => `stance classification, claim ${i + 1}/${k}`), "stances assigned"],
    ["PROVENANCE", ["ordering by publish date", "curl · building link graph", "collapsing syndicated chains"], "original + citation chains found"],
    ["SCORE", ["weighting by tier × confidence × independence"], "verdicts computed"],
  ];
  const DELAY: Record<string, number> = { INGEST: 2200, EXTRACT: 3000, RETRIEVE: 1500, RECON: 1500, CLASSIFY: 2500, PROVENANCE: 1800, SCORE: 1200 };
  const PER_CLAIM = new Set(["RETRIEVE", "CLASSIFY"]);
  const CLAIM_GAP = 1400;
  for (const [id, msgs, doneMsg] of plan) {
    rail.start(id, msgs[0]);
    const base = DELAY[id] ?? 1000;
    if (PER_CLAIM.has(id)) {
      await sleep(base);
      for (const m of msgs) { rail.set(id, m); await sleep(CLAIM_GAP); }
    } else {
      for (const m of msgs) { rail.set(id, m); await sleep(base / msgs.length); }
    }
    rail.done(id, doneMsg);
  }
}
