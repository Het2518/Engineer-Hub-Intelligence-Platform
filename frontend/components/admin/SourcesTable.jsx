"use client";

import { useState } from "react";
import { FileText, AlertTriangle, BookOpen, Code, Image, GitFork, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

const DOC_TYPE_CONFIG = {
  incident_report: { icon: AlertTriangle, label: "Incident", color: "text-destructive" },
  runbook: { icon: BookOpen, label: "Runbook", color: "text-warning" },
  source_code: { icon: Code, label: "Code", color: "text-success" },
  documentation: { icon: FileText, label: "Docs", color: "text-primary" },
  readme: { icon: BookOpen, label: "README", color: "text-secondary" },
  architecture_diagram: { icon: Image, label: "Diagram", color: "text-accent" },
  architecture: { icon: Image, label: "Architecture", color: "text-accent" },
  configuration: { icon: FileText, label: "Config", color: "text-warning" },
  infrastructure: { icon: GitFork, label: "Infra", color: "text-secondary" },
  document: { icon: FileText, label: "Document", color: "text-muted-foreground" },
};

const PAGE_SIZE = 10;

export function SourcesTable({ sources, totalChunks }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const filtered = sources.filter((s) =>
    s.filename.toLowerCase().includes(search.toLowerCase()) ||
    s.doc_type.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const formatDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-3">
      {/* Search + summary */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search sources..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="px-3 py-2 rounded-xl bg-card border border-border text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/40 w-64 transition-colors shadow-sm"
        />
        <p className="text-xs text-muted-foreground/80 font-medium">
          {filtered.length} sources · {totalChunks.toLocaleString()} total chunks
        </p>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-border overflow-hidden shadow-sm bg-card/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Type
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Filename
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                Indexed At
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm font-medium">
                  {search ? "No sources match your search" : "No sources indexed yet"}
                </td>
              </tr>
            ) : (
              paged.map((source, i) => {
                const config = DOC_TYPE_CONFIG[source.doc_type] || DOC_TYPE_CONFIG.document;
                const Icon = config.icon;
                return (
                  <tr
                    key={i}
                    className="border-b border-border/60 hover:bg-foreground/5 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", config.color)} />
                        <span className={cn("text-[10px] font-bold", config.color)}>
                          {config.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-foreground/90 text-xs font-mono font-medium truncate block max-w-[300px]"
                        title={source.filename}
                      >
                        {source.filename}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-muted-foreground/80 text-xs font-medium">
                        {formatDate(source.indexed_at)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-muted/10">
            <span className="text-xs text-muted-foreground/80 font-medium">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
