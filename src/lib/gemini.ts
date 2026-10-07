import { GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import type { z } from "zod";

export const MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

export function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");
  return (client ??= new GoogleGenAI({ apiKey }));
}

export function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

type Tools = NonNullable<GenerateContentConfig["tools"]>;

/**
 * Generate and validate JSON.
 * Gemini can't combine tools with responseMimeType=json, so when tools are
 * passed we ask for JSON in the prompt and strip fences ourselves.
 */
export async function generateJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  opts: { tools?: Tools; temperature?: number } = {}
): Promise<{ data: T; raw: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>> }> {
  const config: GenerateContentConfig = { temperature: opts.temperature ?? 0.1 };
  if (opts.tools) config.tools = opts.tools;
  else config.responseMimeType = "application/json";

  const raw = await getClient().models.generateContent({
    model: MODEL,
    contents: prompt,
    config,
  });

  const text = raw.text;
  if (!text) throw new Error("Empty response from Gemini");
  const data = schema.parse(JSON.parse(stripFences(text)));
  return { data, raw };
}
