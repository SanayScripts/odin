import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Source } from "@/lib/types";
const run = promisify(execFile);

async function sh(cmd: string, args: string[], timeout = 15000): Promise<string | null> {
  try {
    const { stdout } = await run(cmd, args, { timeout, maxBuffer: 5_000_000 });
    return stdout;
  } catch {
    return null; // tool missing, timed out, or failed
  }
}

const strip = (html: string) =>
  html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** INGEST: curl first, Jina only as a fallback for JS-heavy pages. */
export async function fetchPage(url: string): Promise<string> {
  const html = await sh("curl", ["-sL", "--max-time", "12", "-A", "Mozilla/5.0", url]);
  const text = html ? strip(html) : "";
  if (text.length >= 200) return text;
  const res = await fetch(`https://r.jina.ai/${url}`, { signal: AbortSignal.timeout(45000) }).catch(() => null);
  return res?.ok ? res.text() : "";
}

export type DomainProfile = { domain: string; ageDays: number | null; ips: number; stack: string | null; harvested?: string };

export async function profileDomain(domain: string, deep = false): Promise<DomainProfile> {
  const [who, dig, web] = await Promise.all([
    sh("whois", [domain.split(".").slice(-2).join(".")]),
    sh("dig", ["+short", "A", domain]),
    sh("whatweb", ["--color=never", "-a", "1", `https://${domain}`], 25000),
  ]);
  const m = who?.match(/(?:Creation Date|Created|Registered on)[^:\n]*:\s*(\d{4}-\d{2}-\d{2})/i);
  const ageDays = m ? Math.floor((Date.now() - Date.parse(m[1])) / 864e5) : null;
  const ips = dig ? dig.split("\n").filter((l) => /^\d+\.\d+\.\d+\.\d+$/.test(l.trim())).length : 0;
  const stack = web ? web.replace(/\x1b\[[0-9;]*m/g, "").split("\n")[0].replace(/^\S+\s+\[\d+[^\]]*\]\s*/, "").slice(0, 110) : null;
  let harvested: string | undefined;
  if (deep) {
    const h = await sh("theHarvester", ["-d", domain, "-b", "crtsh", "-l", "50"], 60000);
    harvested = h?.split("\n").filter((l) => l.includes(domain)).slice(0, 8).join("\n");
  }
  return { domain, ageDays, ips, stack, harvested };
}

/** Earliest Wayback capture, used as a fallback publish date. */
export async function waybackFirst(url: string): Promise<string | null> {
  const q = encodeURIComponent(url);
  const a = await sh("curl", ["-sL", "--max-time", "20", `https://web.archive.org/cdx/search/cdx?url=${q}&limit=1&fl=timestamp`], 25000);
  let ts = a?.trim().match(/^(\d{4})(\d{2})(\d{2})/) ?? null;
  if (!ts) {
    const b = await sh("curl", ["-sL", "--max-time", "20", `https://archive.org/wayback/available?url=${q}&timestamp=19900101`], 25000);
    ts = b?.match(/"closest":[^}]*"timestamp":\s*"(\d{4})(\d{2})(\d{2})/) ?? null;
  }
  return ts ? `${ts[1]}-${ts[2]}-${ts[3]}` : null;
}

/** Fetch a source page and return its outbound links (citation edges). */
export async function outboundLinks(url: string): Promise<string[]> {
  const html = await sh("curl", ["-sL", "--max-time", "8", "-A", "Mozilla/5.0", url]);
  return html ? [...html.matchAll(/href=["'](https?:\/\/[^"']+)/gi)].map((m) => m[1]) : [];
}

/** If source A's page links to source B (same claim), A cites B and joins B's chain. */
export function linkEdges(sources: Source[], links: Map<string, string[]>, host: (u: string) => string | null): Source[] {
  return sources.map((a) => {
    if (a.citesSourceId || a.isOriginal) return a;
    const out = (links.get(a.id) ?? []).map(host);
    const b = sources.find((b) => b.id !== a.id && b.claimId === a.claimId && b.outlet !== a.outlet && out.includes(b.outlet));
    return b ? { ...a, citesSourceId: b.id, chainId: b.chainId ?? b.id } : a;
  });
}
