import Groq from "groq-sdk";
import type { z } from "zod";

export const MODEL = "llama-3.3-70b-versatile";

let client: Groq | null = null;

export function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set in .env.local");
  return (client ??= new Groq({ apiKey }));
}

export function extractJson(text: string): string {
  const t = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = t.search(/[\[{]/);
  if (start === -1) return t;
  const end = t.lastIndexOf(t[start] === "{" ? "}" : "]");
  return end > start ? t.slice(start, end + 1) : t;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  const msg = e instanceof Error ? e.message : "";
  return status === 429 || status === 503 || /rate.limit|overloaded|unavailable/i.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= tries || !isTransient(e)) throw e;
      await sleep(1500 * attempt);
    }
  }
}

export async function generateJson<T>(
  prompt: string,
  schema: z.ZodType<T>
): Promise<T> {
  const raw = await withRetry(() =>
    getClient().chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    })
  );

  const text = raw.choices[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty response from Groq");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error("Model returned invalid JSON");
  }
  return schema.parse(parsed);
}

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/api.key|invalid_api_key/i.test(msg)) return "Groq API key is invalid. Check GROQ_API_KEY in .env.local and restart.";
  if (/rate.limit|429/i.test(msg)) return "Groq rate limit hit. Wait a moment and try again.";
  if (/503|overloaded|unavailable/i.test(msg)) return "Groq is temporarily unavailable. Try again shortly.";
  return msg.length > 300 ? msg.slice(0, 300) + "…" : msg;
}
