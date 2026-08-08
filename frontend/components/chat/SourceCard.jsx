"use client";

import { cn } from "../../lib/utils";

export function SourceCard({ source }) {
  const isOKF = source.is_okf === true || source.doc_type?.startsWith?.("okf_");
  const shortName = source.filename?.split("/").pop() || source.filename || "Unknown";
  
  let label = "Document";
  if (isOKF) {
    label = source.okf_type || source.doc_type?.replace("okf_", "").replace(/^\w/, (c) => c.toUpperCase()) || "Runbook";
  } else if (source.doc_type) {
    label = source.doc_type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.75rem] font-medium transition-all duration-200 cursor-default px-2.5 py-1 rounded-md w-fit max-w-full",
        "bg-[hsl(var(--secondary)/0.5)] text-muted-foreground hover:bg-[hsl(var(--secondary))] hover:text-foreground",
        isOKF ? "border border-[hsl(var(--border))]" : "border border-transparent"
      )}
      title={`${source.filename}\n\n${source.content_preview || ""}`}
    >
      <span className="truncate">
        {shortName} <span className="opacity-50 font-normal ml-1">· {label}</span>
      </span>
      {!isOKF && source.confidence && (
        <span className="flex-shrink-0 opacity-40 font-mono ml-1 text-[0.6875rem]">
          {source.confidence}%
        </span>
      )}
    </div>
  );
}
