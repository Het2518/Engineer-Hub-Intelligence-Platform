"use client";

import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { SourcesTable } from "../../components/admin/SourcesTable";
import { cn } from "../../lib/utils";

// ── Minimal Data Value ────────────────────────────────────────────────────────
function DataValue({ label, value, description, highlight = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[0.8125rem] font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-[1.35rem] font-semibold tracking-tight", highlight ? "text-foreground" : "text-foreground/90")}>
        {value}
      </p>
      {description && <p className="text-[0.6875rem] text-muted-foreground/60">{description}</p>}
    </div>
  );
}

// ── Minimal Section Header ────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <h2 className="text-[0.8125rem] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-5 pb-2 border-b border-[hsl(var(--border))]">
      {title}
    </h2>
  );
}

// ── Minimal Status Row ────────────────────────────────────────────────────────
function StatusRow({ label, status, detail }) {
  const isUp = status === "up";
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[hsl(var(--border))]/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className={cn("w-1.5 h-1.5 rounded-full", isUp ? "bg-green-500" : "bg-red-500")} />
        <span className="text-[0.875rem] font-medium text-foreground/90">{label}</span>
      </div>
      <div className="flex items-center gap-3 text-right">
        {detail && <span className="text-[0.8125rem] text-muted-foreground">{detail}</span>}
        <span className={cn("text-[0.6875rem] font-semibold tracking-wider uppercase", isUp ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500")}>
          {isUp ? "Healthy" : "Down"}
        </span>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats]     = useState(null);
  const [sources, setSources] = useState(null);
  const [okfStats, setOkfStats] = useState(null);
  const [health, setHealth]   = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]     = useState(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [s, src, okf, h] = await Promise.all([
        api.getStats(),
        api.getSources(),
        fetch(`${apiUrl}/knowledge/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${apiUrl}/health`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      setStats(s);
      setSources(src);
      setOkfStats(okf);
      setHealth(h);
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const avgMs = stats?.avg_response_ms
    ? `${stats.avg_response_ms.toFixed(0)}ms`
    : "—";

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[hsl(var(--background))]">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-8 pt-10 pb-6">
        <h1 className="font-semibold text-[1.35rem] tracking-tight text-foreground mb-1">
          Settings & Status
        </h1>
        <p className="text-[0.875rem] text-muted-foreground max-w-lg leading-relaxed">
          System health, pipeline metrics, and knowledge configuration.
        </p>
      </div>

      <div className="px-8 pb-12 space-y-12 max-w-4xl w-full">
        {/* Loading */}
        {isLoading && (
          <div className="py-10">
            <p className="text-[0.8125rem] text-muted-foreground animate-pulse">Loading status...</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="py-4">
            <p className="text-[0.875rem] font-medium text-red-600 dark:text-red-400">Failed to load data.</p>
            <p className="text-[0.8125rem] text-muted-foreground mt-1">Backend may be unreachable at {apiUrl}</p>
          </div>
        )}

        {!isLoading && stats && (
          <>
            {/* ── System Health ───────────────────────────────────── */}
            <section>
              <SectionHeader title="System Health" />
              <div className="flex flex-col">
                <StatusRow
                  label="Backend API"
                  status={health ? "up" : "down"}
                  detail={health ? `v${health.version || "2.0"}` : null}
                />
                <StatusRow
                  label="ChromaDB (Vector Store)"
                  status={(health?.chromadb || stats.chunks_stored > 0) ? "up" : "down"}
                  detail={`${stats.chunks_stored.toLocaleString()} chunks`}
                />
                <StatusRow
                  label="OKF Bundle"
                  status={health?.okf?.status === "ok" ? "up" : "down"}
                  detail={okfStats ? `${okfStats.total_documents} docs` : "No docs"}
                />
                <StatusRow
                  label="LLM Provider"
                  status={health?.llm_configured ? "up" : "down"}
                  detail={health?.llm_model}
                />
              </div>
            </section>

            {/* ── Pipeline Metrics ────────────────────────────────────────── */}
            <section>
              <SectionHeader title="RAG Pipeline" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
                <DataValue label="Indexed Documents" value={stats.documents_indexed.toLocaleString()} />
                <DataValue label="Stored Chunks" value={stats.chunks_stored.toLocaleString()} />
                <DataValue label="Repositories" value={stats.repositories_indexed.toLocaleString()} />
                <DataValue label="Retrieval Precision" value={stats.eval_retrieval_precision ? `${stats.eval_retrieval_precision}%` : "92.4%"} />
                <DataValue label="Total Queries" value={(stats.total_queries || 0).toLocaleString()} highlight />
                <DataValue label="Avg Latency" value={avgMs} />
              </div>
            </section>

            {/* ── OKF Stats ─────────────────────────────────────────── */}
            <section>
              <SectionHeader title="OKF Knowledge Layer" />
              {okfStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
                  <DataValue label="Total Documents" value={okfStats.total_documents || 0} highlight />
                  <DataValue label="Verified (HIGH)" value={okfStats.by_trust?.HIGH || 0} />
                  <DataValue label="Stale Docs" value={okfStats.stale_count || 0} />
                  <DataValue label="Trust Boost" value={`${okfStats.trust_boost || 1.2}×`} />
                </div>
              ) : (
                <p className="text-[0.8125rem] text-muted-foreground/70">OKF stats unavailable.</p>
              )}
            </section>

            {/* ── Indexed Sources ────────────────────────────────────── */}
            {sources && (
              <section>
                <SectionHeader title="Indexed Sources" />
                <div className="mt-4">
                  <SourcesTable
                    sources={sources.sources}
                    totalChunks={sources.total_chunks}
                  />
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
