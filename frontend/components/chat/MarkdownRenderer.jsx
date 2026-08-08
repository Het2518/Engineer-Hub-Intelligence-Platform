"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Mermaid } from "./Mermaid";
import { CodeBlock } from "./CodeBlock";

function formatSourceBadges(text) {
  if (!text) return "";
  let clean = text.replace(/\n?```knowledge_cards[\s\S]*?```\n?/g, "");
  
  // Replace [Source: Title] or [Source: Title | Type: Type] with an inline HTML badge
  clean = clean.replace(/\[Source:\s*(.+?)(?:\s*\|\s*Type:\s*(.+?))?\]/gi, (match, title, type) => {
    return `<span class="source-chip" title="Source: ${title}">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
      <span class="source-chip-text">${title}</span>
    </span>`;
  });

  return clean;
}



const markdownComponents = {
  code({ node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match ? match[1] : "";
    const codeString = String(children).replace(/\n$/, "");

    if (lang === "mermaid") {
      return <Mermaid chart={codeString} />;
    }

    if (match || String(children).includes("\n")) {
      return <CodeBlock lang={lang} codeString={codeString} {...props} />;
    }

    return (
      <code className="inline-code" {...props}>
        {children}
      </code>
    );
  },

  table: ({ children }) => (
    <div className="md-table-wrapper">
      <table className="md-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr:    ({ children }) => <tr>{children}</tr>,
  th:    ({ children }) => <th>{children}</th>,
  td:    ({ children }) => <td>{children}</td>,
};

export function MarkdownRenderer({ content, streaming = false }) {
  const clean = formatSourceBadges(content || "");

  return (
    <div className={`prose-premium${streaming ? " streaming-cursor" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {clean}
      </ReactMarkdown>
    </div>
  );
}
