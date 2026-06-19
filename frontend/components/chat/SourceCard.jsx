"use client";

import { FileText, Code, AlertTriangle, BookOpen, Image } from "lucide-react";
import { cn } from "../../lib/utils";

const docTypeConfig = {
  incident_report: {
    icon: AlertTriangle,
    color: "text-destructive bg-destructive/10 border-destructive/20",
    label: "Incident",
  },
  runbook: {
    icon: BookOpen,
    color: "text-warning bg-warning/10 border-warning/20",
    label: "Runbook",
  },
  source_code: {
    icon: Code,
    color: "text-success bg-success/10 border-success/20",
    label: "Code",
  },
  architecture_diagram: {
    icon: Image,
    color: "text-accent bg-accent/10 border-accent/20",
    label: "Diagram",
  },
  architecture: {
    icon: Image,
    color: "text-accent bg-accent/10 border-accent/20",
    label: "Architecture",
  },
  documentation: {
    icon: FileText,
    color: "text-primary bg-primary/10 border-primary/20",
    label: "Docs",
  },
  readme: {
    icon: BookOpen,
    color: "text-secondary bg-secondary/10 border-secondary/20",
    label: "README",
  },
};

const defaultConfig = {
  icon: FileText,
  color: "text-muted-foreground bg-muted border-border",
  label: "Document",
};

export function SourceCard({ source }) {
  const config = docTypeConfig[source.doc_type] || defaultConfig;
  const Icon = config.icon;

  const shortName = source.filename.split("/").pop() || source.filename;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs shadow-sm",
        "transition-all duration-200 hover:scale-[1.02] cursor-default group",
        "max-w-[280px]",
        config.color
      )}
      title={`${source.filename}\nConfidence: ${source.confidence}%\n\n${source.content_preview}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{shortName}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={cn("text-[10px] font-semibold opacity-70")}>
          {config.label}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
            source.confidence >= 80
              ? "bg-success/20 text-success"
              : source.confidence >= 60
              ? "bg-warning/20 text-warning"
              : "bg-destructive/20 text-destructive"
          )}
        >
          {source.confidence}%
        </span>
      </div>
    </div>
  );
}
