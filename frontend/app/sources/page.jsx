"use client";

import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { SourcesTable } from "../../components/admin/SourcesTable";
import { Loader2, AlertTriangle, Database } from "lucide-react";

export default function SourcesPage() {
  const [sources, setSources] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSources = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const src = await api.getSources();
      setSources(src);
    } catch (err) {
      setError(err.message || "Failed to load sources");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[hsl(var(--background))]">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-8 pt-10 pb-6 border-b border-[hsl(var(--border))]">
        <h1 className="font-semibold text-[1.35rem] tracking-tight text-foreground mb-1 flex items-center gap-2">
          <Database className="w-5 h-5 text-muted-foreground" />
          Indexed Sources
        </h1>
        <p className="text-[0.875rem] text-muted-foreground max-w-lg leading-relaxed">
          Manage and view all raw documents and code currently indexed in the vector store.
        </p>
      </div>

      <div className="flex-1 p-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
            <p className="text-[0.8125rem] text-muted-foreground animate-pulse">Loading sources...</p>
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 p-5 border border-red-500/20 rounded-2xl bg-red-500/10 mx-auto max-w-md mt-8 shadow-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-red-500" />
            <div>
              <p className="font-semibold text-[0.875rem] mb-1 text-red-700 dark:text-red-400">Failed to load sources</p>
              <p className="text-[0.8125rem] text-red-600 dark:text-red-500">{error}</p>
            </div>
          </div>
        ) : sources ? (
          <div className="max-w-5xl">
            <SourcesTable
              sources={sources.sources}
              totalChunks={sources.total_chunks}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
