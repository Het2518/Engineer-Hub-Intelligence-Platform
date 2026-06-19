"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function StreamingMessage({ content }) {
  if (!content) {
    return (
      <div className="flex items-center gap-1.5 h-5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
      </div>
    );
  }

  return (
    <div className="prose-dark streaming-cursor">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
