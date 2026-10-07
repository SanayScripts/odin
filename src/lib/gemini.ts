import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import type { z } from "zod";

export const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

let client: GoogleGenAI | null = null;

export function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");
  return (client ??= new GoogleGenAI({ apiKey }));
}

export function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/** Pull the outermost JSON object/array out of text that may have chatter around it. */
export function extractJson(text: string): string {
  const t = stripFences(text);
  const start = t.search(/[\[{]/);
  if (start === -1) return t;
  const end = t.lastIndexOf(t[start] === "{" ? "}" : "]");
  return end > start ? t.slice(start, end + 1) : t;
}

type Tools = NonNullable<GenerateContentConfig["tools"]>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  const msg = e instanceof Error ? e.message : "";
  return status === 429 || status === 503 || /overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(msg);
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

/**
 * Generate and validate JSON.
 * Gemini can't combine tools with responseMimeType=json, so when tools are
 * passed we ask for JSON in the prompt and extract it ourselves.
 */
export async function generateJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  opts: { tools?: Tools; temperature?: number } = {}
): Promise<{ data: T; raw: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>> }> {
  const config: GenerateContentConfig = { temperature: opts.temperature ?? 0.1 };
  if (opts.tools) config.tools = opts.tools;
  else config.responseMimeType = "application/json";

  const raw = await withRetry(() =>
    getClient().models.generateContent({ model: MODEL, contents: prompt, config })
  );

  const text = raw.text;
  if (!text) throw new Error("Empty response from Gemini");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error("Model returned invalid JSON");
  }
  return { data: schema.parse(parsed), raw };
}

/** Turn raw Gemini SDK errors into short user-facing messages. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/API_KEY_INVALID|API key not valid/i.test(msg)) return "Gemini API key is invalid. Check GEMINI_API_KEY in .env.local and restart the dev server.";
  if (/RESOURCE_EXHAUSTED|429/.test(msg)) return "Gemini rate limit hit. Wait a minute and try again.";
  if (/NOT_FOUND|no longer available/i.test(msg)) return "Gemini model unavailable. Set GEMINI_MODEL in .env.local to a current model and restart.";
  if (/UNAVAILABLE|503|overloaded/i.test(msg)) return "Gemini is overloaded. Try again shortly.";
  return msg.length > 300 ? msg.slice(0, 300) + "…" : msg;
}
