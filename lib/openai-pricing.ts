/**
 * OpenAI model pricing (USD per 1M tokens).
 * Update OPENAI_PRICING_VERSION when rates change.
 */

export const OPENAI_PRICING_VERSION = "2026-07-10";

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4-turbo": { inputPer1M: 10.0, outputPer1M: 30.0 },
  o1: { inputPer1M: 15.0, outputPer1M: 60.0 },
  "o1-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },
  "o3-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },
};

/**
 * Returns per-million-token pricing for a model, or null if unknown.
 */
export function getModelPricing(model: string): ModelPricing | null {
  const normalized = model.trim().toLowerCase();
  return MODEL_PRICING[normalized] ?? null;
}

/**
 * Estimates USD cost from token counts using the pricing table.
 * Unknown models return 0.
 */
export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = getModelPricing(model);
  if (!pricing) {
    return 0;
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
  const total = inputCost + outputCost;

  return Math.round(total * 1_000_000) / 1_000_000;
}
