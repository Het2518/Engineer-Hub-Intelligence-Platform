"use client";

import { Shield, BookOpen, AlertTriangle, Layers, LayoutDashboard, FileText, Activity } from "lucide-react";
import { cn } from "../../lib/utils";

const OKF_TYPE_CONFIG = {
  Runbook:        { label: "Runbook",        icon: BookOpen },
  Playbook:       { label: "Playbook",       icon: FileText },
  IncidentReport: { label: "Incident",       icon: AlertTriangle },
  Architecture:   { label: "Architecture",   icon: Layers },
  Standard:       { label: "Standard",       icon: LayoutDashboard },
  Metric:         { label: "Metric",         icon: Activity },
};

const TRUST_CONFIG = {
  HIGH:   { label: "Verified" },
  MEDIUM: { label: "Authored" },
  LOW:    { label: "Draft" },
};

export function OKFDocumentCard({ doc, onClick, isActive }) {
  const typeConf  = OKF_TYPE_CONFIG[doc.okf_type] || OKF_TYPE_CONFIG.Standard;
  const trustConf = TRUST_CONFIG[doc.trust_level] || TRUST_CONFIG.LOW;
  const TypeIcon  = typeConf.icon;

  return (
    <button
      onClick={() => onClick(doc)}
      className={cn(
        "w-full text-left rounded-[var(--radius)] border p-5 transition-all duration-200 group animate-fade-in-up",
        isActive 
          ? "bg-[hsl(var(--secondary))] border-[hsl(var(--border))]" 
          : "bg-[hsl(var(--card))] border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary)/0.5)] hover:border-[hsl(var(--muted-foreground)/0.3)] shadow-sm hover:shadow-md"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div
          className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0 bg-[hsl(var(--background))] border border-[hsl(var(--border))]"
        >
          <TypeIcon className="w-4 h-4 text-foreground" />
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Stale warning */}
          {doc.is_stale && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm border border-orange-500/50 text-orange-600 dark:text-orange-400"
              title="This document hasn't been updated in 90+ days"
            >
              ⚠ Stale
            </span>
          )}
          {/* Trust badge */}
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1 bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-muted-foreground"
          >
            {doc.trust_level === "HIGH" && <Shield className="w-2.5 h-2.5 text-green-600 dark:text-green-500" />}
            {trustConf.label}
          </span>
        </div>
      </div>

      {/* Type chip */}
      <span
        className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-sm mb-2 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-foreground"
      >
        {typeConf.label}
      </span>

      {/* Title */}
      <h3 className="font-semibold text-sm leading-snug mb-1.5 line-clamp-2 text-foreground">
        {doc.title}
      </h3>

      {/* Description */}
      {doc.description && (
        <p className="text-xs line-clamp-2 mb-3 text-muted-foreground">
          {doc.description}
        </p>
      )}

      {/* Tags */}
      {doc.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {doc.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-[hsl(var(--secondary)/0.5)] text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
          {doc.tags.length > 4 && (
            <span className="text-[9px] px-1.5 py-0.5 text-muted-foreground opacity-70">
              +{doc.tags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* OKF stamp */}
      <div
        className="mt-3 pt-3 flex items-center gap-1 text-[9px] font-bold border-t border-[hsl(var(--border))] text-muted-foreground/70"
      >
        <Shield className="w-2.5 h-2.5" />
        Axiom OKF
        <span className="ml-auto font-normal opacity-70">
          {doc.category}
        </span>
      </div>
    </button>
  );
}

export { OKF_TYPE_CONFIG, TRUST_CONFIG };
