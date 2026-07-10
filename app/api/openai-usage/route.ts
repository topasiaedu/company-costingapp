import { NextResponse } from "next/server";
import {
  estimateCostUsd,
  getModelPricing,
  OPENAI_PRICING_VERSION,
} from "@/lib/openai-pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { openaiUsageIngestSchema } from "@/lib/validations/openai-usage";

function unauthorizedIngestSecret(): NextResponse {
  return NextResponse.json(
    { error: "Invalid or missing X-Ingest-Secret header" },
    { status: 401 }
  );
}

function checkIngestSecret(request: Request): NextResponse | null {
  const ingestSecret = process.env.INGEST_SECRET;
  if (!ingestSecret) {
    return null;
  }

  const headerSecret = request.headers.get("X-Ingest-Secret");
  if (headerSecret !== ingestSecret) {
    return unauthorizedIngestSecret();
  }

  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const secretError = checkIngestSecret(request);
  if (secretError) {
    return secretError;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = openaiUsageIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (!getModelPricing(data.model)) {
    console.warn(
      `[openai-usage] Unknown model "${data.model}" — estimatedCostUsd will be 0`
    );
  }

  const estimatedCostUsd = estimateCostUsd(
    data.model,
    data.promptTokens,
    data.completionTokens
  );

  const admin = createAdminClient();

  if (data.requestId) {
    const { data: existing, error: lookupError } = await admin
      .from("openai_usage_events")
      .select("id")
      .eq("request_id", data.requestId)
      .maybeSingle();

    if (lookupError) {
      console.error("[openai-usage] requestId lookup failed:", lookupError.message);
      return NextResponse.json(
        { error: "Database error during deduplication check" },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "Duplicate requestId", requestId: data.requestId },
        { status: 409 }
      );
    }
  }

  const { data: inserted, error: insertError } = await admin
    .from("openai_usage_events")
    .insert({
      app_id: data.appId,
      app_name: data.appName ?? null,
      request_id: data.requestId ?? null,
      model: data.model,
      prompt_tokens: data.promptTokens,
      completion_tokens: data.completionTokens,
      total_tokens: data.totalTokens,
      feature: data.feature ?? null,
      occurred_at: data.occurredAt,
      estimated_cost_usd: estimatedCostUsd,
      price_snapshot: OPENAI_PRICING_VERSION,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505" && data.requestId) {
      return NextResponse.json(
        { error: "Duplicate requestId", requestId: data.requestId },
        { status: 409 }
      );
    }

    console.error("[openai-usage] insert failed:", insertError.message);
    return NextResponse.json({ error: "Failed to store usage event" }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: inserted.id,
      estimatedCostUsd,
      appId: data.appId,
      model: data.model,
    },
    { status: 201 }
  );
}
