"use client";

import { Workflow, Server, Lightbulb, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

const typeConfig = {
  service: {
    icon: Server,
    gradient: "from-primary/10 to-secondary/10",
    border: "border-primary/15",
  },
  flow: {
    icon: Workflow,
    gradient: "from-secondary/10 to-accent/10",
    border: "border-secondary/15",
  },
  concept: {
    icon: Lightbulb,
    gradient: "from-accent/10 to-warning/10",
    border: "border-accent/15",
  },
  alert: {
    icon: AlertTriangle,
    gradient: "from-destructive/10 to-destructive/20",
    border: "border-destructive/15",
  },
};

const defaultType = {
  icon: Lightbulb,
  gradient: "from-success/10 to-success/20",
  border: "border-success/15",
};

export function KnowledgeCard({ card }) {
  const config = typeConfig[card.type] || defaultType;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-xs shadow-sm",
        "bg-gradient-to-br transition-all duration-200 hover:scale-[1.01] glass",
        config.gradient,
        config.border
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h4 className="font-semibold text-foreground leading-tight mb-1">
            {card.title}
          </h4>
          <p className="text-muted-foreground leading-relaxed text-[11px] font-medium">
            {card.content}
          </p>
        </div>
      </div>
    </div>
  );
}
