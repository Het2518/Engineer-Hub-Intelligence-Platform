"use client";

import { MarkdownRenderer } from "./MarkdownRenderer";

export function StreamingMessage({ content }) {
  if (!content) {
    return (
      <div className="flex flex-col gap-2.5 w-full max-w-xl animate-pulse mt-2 mb-4">
        <div className="h-4 bg-[hsl(var(--secondary))] rounded w-3/4"></div>
        <div className="h-4 bg-[hsl(var(--secondary))] rounded w-full"></div>
        <div className="h-4 bg-[hsl(var(--secondary))] rounded w-5/6"></div>
      </div>
    );
  }

  const cleanContent = content.replace(/```knowledge_cards[\s\S]*?```/g, "");

  return (
    <div className="streaming-markdown">
      <MarkdownRenderer content={cleanContent} streaming={true} />
    </div>
  );
}
