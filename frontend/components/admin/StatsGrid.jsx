"use client";

import {
  FileText,
  GitFork,
  Database,
  MessageSquare,
  Zap,
  TrendingUp,
} from "lucide-react";
import { cn } from "../../lib/utils";

export function StatsGrid({ stats }) {
  const cards = [
    {
      label: "Documents Indexed",
      value: stats.documents_indexed.toLocaleString(),
      icon: FileText,
      description: "Files ingested into knowledge base",
      color: "text-primary",
      glow: "shadow-primary/10",
    },
    {
      label: "Repositories",
      value: stats.repositories_indexed.toLocaleString(),
      icon: GitFork,
      description: "GitHub repos indexed",
      color: "text-accent",
      glow: "shadow-accent/10",
    },
    {
      label: "Chunks Stored",
      value: stats.chunks_stored.toLocaleString(),
      icon: Database,
      description: "Vector embeddings in ChromaDB",
      color: "text-secondary",
      glow: "shadow-secondary/10",
    },
    {
      label: "Total Queries",
      value: stats.total_queries.toLocaleString(),
      icon: MessageSquare,
      description: "Questions answered",
      color: "text-success",
      glow: "shadow-success/10",
    },
    {
      label: "Avg Response Time",
      value: stats.avg_response_time_ms > 0 ? `${stats.avg_response_time_ms.toFixed(0)}ms` : "—",
      icon: Zap,
      description: "Average end-to-end latency",
      color: "text-warning",
      glow: "shadow-warning/10",
    },
    {
      label: "Embedding Model",
      value: "3-small",
      icon: TrendingUp,
      description: "text-embedding-3-small",
      color: "text-destructive",
      glow: "shadow-destructive/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={cn(
              "glass rounded-2xl p-5 border border-border shadow-sm bg-card/50",
              "hover:border-primary/40 transition-all duration-200 hover:scale-[1.01]",
              card.glow
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <Icon className={cn("w-5 h-5", card.color)} />
              <span className={cn("text-2xl font-bold", card.color)}>
                {card.value}
              </span>
            </div>
            <p className="text-foreground text-sm font-semibold">{card.label}</p>
            <p className="text-muted-foreground text-xs mt-0.5 font-medium">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
}
