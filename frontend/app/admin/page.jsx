"use client";

import { useState, useEffect } from "react";
import { BarChart3, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { StatsGrid } from "../../components/admin/StatsGrid";
import { SourcesTable } from "../../components/admin/SourcesTable";

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [sources, setSources] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [s, src] = await Promise.all([api.getStats(), api.getSources()]);
      setStats(s);
      setSources(src);
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0 flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-xl">Admin Dashboard</h1>
            <p className="text-muted-foreground text-xs mt-0.5 font-medium">
              Knowledge base metrics and indexed sources
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-accent hover:bg-accent/10 border border-transparent hover:border-accent/30 transition-all duration-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 p-6 space-y-8 max-w-6xl mx-auto w-full">
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-destructive/10 border border-destructive/20 shadow-sm">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Failed to load data</p>
              <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Make sure the backend is running at {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && !isLoading && (
          <div className="animate-fade-in">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              System Metrics
            </h2>
            <StatsGrid stats={stats} />
          </div>
        )}

        {/* Sources table */}
        {sources && !isLoading && (
          <div className="animate-fade-in">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Indexed Sources
            </h2>
            <SourcesTable
              sources={sources.sources}
              totalChunks={sources.total_chunks}
            />
          </div>
        )}
      </div>
    </div>
  );
}
