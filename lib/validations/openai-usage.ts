import { z } from "zod";

const TOKEN_TOTAL_MARGIN = 2;

const baseOpenaiUsageIngestSchema = z.object({
  appId: z.string().min(1, "appId is required"),
  appName: z.string().optional(),
  requestId: z.string().min(1).optional(),
  model: z.string().min(1, "model is required"),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  feature: z.string().optional(),
  occurredAt: z.string().datetime({ message: "occurredAt must be ISO 8601 datetime" }),
});

/**
 * Validates ingest payload for POST /api/openai-usage.
 * Coerces totalTokens when within a small margin of prompt + completion.
 */
export const openaiUsageIngestSchema = baseOpenaiUsageIngestSchema
  .superRefine((data, ctx) => {
    const expected = data.promptTokens + data.completionTokens;
    const delta = Math.abs(data.totalTokens - expected);

    if (delta > TOKEN_TOTAL_MARGIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `totalTokens (${data.totalTokens}) must equal promptTokens + completionTokens (${expected}), within ${TOKEN_TOTAL_MARGIN} tokens`,
        path: ["totalTokens"],
      });
    }
  })
  .transform((data) => {
    const expected = data.promptTokens + data.completionTokens;
    if (data.totalTokens !== expected) {
      return { ...data, totalTokens: expected };
    }
    return data;
  });

export type OpenAiUsageIngestInput = z.infer<typeof openaiUsageIngestSchema>;
