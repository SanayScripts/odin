import { z } from "zod";

export const EntitySchema = z.object({
  name: z.string(),
  type: z.enum(["person", "org", "location", "other"]),
});

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  entities: z.array(EntitySchema),
  dates: z.array(z.string()),
  locations: z.array(z.string()),
});

export const StanceSchema = z.enum(["supports", "conflicts", "neutral"]);

export const SourceSchema = z.object({
  id: z.string(),
  claimId: z.string(),
  url: z.string(),
  title: z.string(),
  outlet: z.string(),
  snippet: z.string().optional(),
  publishDate: z.string().nullable(),
  author: z.string().nullable(),
  tier: z.number().min(1).max(5).optional(),
  stance: StanceSchema.optional(),
  stanceConfidence: z.number().min(0).max(1).optional(),
  isOriginal: z.boolean().optional(),
  citesSourceId: z.string().nullable().optional(),
  chainId: z.string().optional(),
  geoMismatch: z.boolean().optional(),
});

export const VerdictSchema = z.enum(["supported", "contested", "insufficient"]);

export const ClaimResultSchema = z.object({
  claimId: z.string(),
  verdict: VerdictSchema,
  confidence: z.number().min(0).max(1),
  independentChains: z.number(),
  support: z.number(),
  conflict: z.number(),
});

export const ReportSchema = z.object({
  input: z.string(),
  claims: z.array(ClaimSchema),
  sources: z.array(SourceSchema),
  results: z.array(ClaimResultSchema),
  overall: VerdictSchema,
  overallConfidence: z.number(),
});

export const VerifyRequestSchema = z.object({
  input: z.string().trim().min(8, "Enter a URL or a claim (min 8 chars)").max(8000),
});

export const STAGES = [
  "INGEST",
  "EXTRACT",
  "RETRIEVE",
  "CLASSIFY",
  "PROVENANCE",
  "SCORE",
  "DONE",
] as const;

export type Stage = (typeof STAGES)[number];
export type Entity = z.infer<typeof EntitySchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Stance = z.infer<typeof StanceSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type ClaimResult = z.infer<typeof ClaimResultSchema>;
export type Report = z.infer<typeof ReportSchema>;

export type SSEEvent =
  | { type: "stage"; stage: Stage; status: "start" | "done" }
  | { type: "data"; stage: Stage; payload: unknown }
  | { type: "error"; message: string };
