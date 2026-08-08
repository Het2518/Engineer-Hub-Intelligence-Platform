"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Plus, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { OKFDocumentCard, OKF_TYPE_CONFIG } from "../../components/knowledge/OKFDocumentCard";
import { OKFDocumentViewer } from "../../components/knowledge/OKFDocumentViewer";
import { OKFCreateForm } from "../../components/knowledge/OKFCreateForm";

const ALL_FILTER = "All";

export default function KnowledgePage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError]         = useState("");
  const [query, setQuery]         = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [editDoc, setEditDoc]         = useState(null);
  const [stats, setStats]             = useState({ types: {}, total: 0, verified: 0, stale: 0 });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${apiUrl}/knowledge/`);
      if (!res.ok) throw new Error("Failed to load knowledge base");
      const data = await res.json();
      setDocuments(data.documents || []);
      computeStats(data.documents || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const computeStats = (docs) => {
    const types = {};
    let verified = 0, stale = 0;
    docs.forEach((d) => {
      types[d.okf_type] = (types[d.okf_type] || 0) + 1;
      if (d.trust_level === "HIGH") verified++;
      if (d.is_stale) stale++;
    });
    setStats({ types, total: docs.length, verified, stale });
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await fetch(`${apiUrl}/knowledge/reload`, { method: "POST" });
      await fetchDocuments();
    } finally {
      setReloading(false);
    }
  };

  const handleCreateSuccess = async () => {
    setShowCreate(false);
    setEditDoc(null);
    await fetchDocuments();
  };

  useEffect(() => { fetchDocuments(); }, []);

  // Client-side filtering
  const filteredDocs = useMemo(() => {
    let result = documents;
    if (typeFilter !== ALL_FILTER) {
      result = result.filter((d) => d.okf_type === typeFilter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.tags?.some((t) => t.toLowerCase().includes(q)) ||
          d.content_preview?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [documents, typeFilter, query]);

  const allTypes = [ALL_FILTER, ...Object.keys(OKF_TYPE_CONFIG)];
  const showPanel = selectedDoc || showCreate || editDoc;

  return (
    <div className="flex h-full overflow-hidden bg-[hsl(var(--background))]">
      {/* ═══ Main Panel ═══════════════════════════════════════════════════ */}
      <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-150 ${showPanel ? "w-[56%]" : "w-full"}`}>

        {/* ── Page Header ────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-8 pt-10 pb-6 border-b border-[hsl(var(--border))]">
          {/* Title row */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-semibold text-[1.35rem] tracking-tight text-foreground">
                Knowledge Studio
              </h1>
              <p className="text-[0.875rem] mt-1 text-muted-foreground">
                Deterministic knowledge base for Engineer Hub.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReload}
                disabled={reloading}
                className="btn-ghost px-3 py-2 transition-transform hover:scale-[1.02]"
                title="Reload knowledge bundle from disk"
              >
                <RefreshCw className={`w-4 h-4 ${reloading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => { setShowCreate(true); setSelectedDoc(null); setEditDoc(null); }}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                New Document
              </button>
            </div>
          </div>

          {/* ── Stats strip ────────────────────────────────────────── */}
          <div className="flex items-center gap-10 mb-8 px-1">
            {[
              { label: "Total Docs",     value: stats.total },
              { label: "Verified OKF",   value: stats.verified },
              { label: "Needs Review",   value: stats.stale },
            ].map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="text-[1.125rem] font-semibold text-foreground">{s.value}</span>
                <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/70">{s.label}</span>
              </div>
            ))}
          </div>

          {/* ── Search + Type filter ─────────────────────────────── */}
          <div className="flex flex-col gap-5">
            <div className="relative w-full max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-50" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, tag, or content…"
                className="axiom-input pl-10 h-10 rounded-xl bg-[hsl(var(--card))]"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {allTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-[0.8125rem] font-medium transition-all duration-200 border ${
                    typeFilter === t
                      ? "bg-foreground text-background border-transparent shadow-sm"
                      : "bg-transparent text-muted-foreground border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground)/0.3)] hover:bg-[hsl(var(--secondary)/0.5)]"
                  }`}
                >
                  {t === ALL_FILTER ? "All" : (OKF_TYPE_CONFIG[t]?.label || t)}
                  {t !== ALL_FILTER && stats.types[t] != null && (
                    <span className="ml-1.5 opacity-60 font-normal">({stats.types[t]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Document Grid ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-8 bg-[hsl(var(--background))]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
              <p className="text-[0.8125rem] text-muted-foreground animate-pulse">Loading knowledge bundle…</p>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 p-5 border border-red-500/20 rounded-2xl bg-red-500/10 mx-auto max-w-md mt-8 shadow-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-red-500" />
              <div>
                <p className="font-semibold text-[0.875rem] mb-1 text-red-700 dark:text-red-400">Failed to load knowledge base</p>
                <p className="text-[0.8125rem] text-red-600 dark:text-red-500">{error}</p>
              </div>
            </div>
          ) : filteredDocs.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <p className="text-[0.875rem] font-medium text-foreground">
                {query || typeFilter !== ALL_FILTER ? "No documents match your filters" : "No documents yet"}
              </p>
              <p className="text-[0.8125rem] text-muted-foreground max-w-sm">
                Knowledge documents provide deterministic context to the Engineer Hub assistant.
              </p>
              {!query && typeFilter === ALL_FILTER && (
                <button onClick={() => setShowCreate(true)} className="text-[0.8125rem] font-medium underline underline-offset-4 text-muted-foreground hover:text-foreground mt-2">
                  Create your first document
                </button>
              )}
            </div>
          ) : (
            <div className={`grid gap-4 ${showPanel ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 lg:gap-6"}`}>
              {filteredDocs.map((doc) => (
                <OKFDocumentCard
                  key={doc.source_id}
                  doc={doc}
                  isActive={selectedDoc?.source_id === doc.source_id}
                  onClick={(d) => {
                    setSelectedDoc(d);
                    setShowCreate(false);
                    setEditDoc(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── OKF footer badge ─────────────────────────────────── */}
        <div className="flex-shrink-0 px-8 py-4 flex items-center justify-between text-[0.6875rem] font-medium text-muted-foreground border-t border-[hsl(var(--border))]">
          <span>Engineer Hub Knowledge Studio</span>
          <span>{stats.verified} verified documents</span>
        </div>
      </div>

      {/* ═══ Side Panel ═══════════════════════════════════════════════════ */}
      {showPanel && (
        <div
          className="flex-shrink-0 transition-all duration-300 overflow-hidden border-l border-[hsl(var(--border))] bg-background shadow-xl"
          style={{ width: "44%", minWidth: "400px" }}
        >
          {showCreate || editDoc ? (
            <OKFCreateForm
              initialDoc={editDoc || null}
              onSuccess={handleCreateSuccess}
              onCancel={() => { setShowCreate(false); setEditDoc(null); }}
            />
          ) : selectedDoc ? (
            <OKFDocumentViewer
              doc={selectedDoc}
              onClose={() => setSelectedDoc(null)}
              onEdit={(doc) => { setEditDoc(doc); setShowCreate(false); }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
