"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

/**
 * Interactive OpenAPI documentation for POST /api/openai-usage.
 * Spec is served from /openapi.yaml (public/openapi.yaml at build time).
 */
export default function ApiDocsPage() {
  useEffect(() => {
    document.title = "API Docs — Company Costing";
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">Ingest API Documentation</h1>
            <p className="text-sm text-[var(--muted)]">
              OpenAI token usage — POST /api/openai-usage
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            ← Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-2 py-4 sm:px-4">
        <SwaggerUI url="/openapi.yaml" docExpansion="list" defaultModelsExpandDepth={1} />
      </main>
    </div>
  );
}
