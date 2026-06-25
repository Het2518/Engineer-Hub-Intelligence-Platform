"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useCallback } from "react";
import { Copy, Check, Download } from "lucide-react";

/* ─── Strip leaked knowledge_cards JSON from streamed content ──────────── */
function cleanContent(raw) {
  if (!raw) return "";
  return raw
    .replace(/\n?knowledge_cards\s*\n[\s\S]*$/i, "")
    .replace(/\n\[\n[\s\S]*?\]\s*$/g, "")
    .replace(/\[SOURCE:[^\]]+\]/g, "")
    .trimEnd();
}

/* ─── helpers (duplicated here to avoid circular import) ──────────────────── */
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return { copied, copy };
}

function downloadCode(code, lang) {
  const extMap = {
    javascript: "js", js: "js", typescript: "ts", ts: "ts",
    python: "py", py: "py", java: "java", go: "go", rust: "rs",
    cpp: "cpp", c: "c", cs: "cs", html: "html", css: "css",
    json: "json", yaml: "yaml", yml: "yml", bash: "sh", sh: "sh",
    shell: "sh", sql: "sql", markdown: "md", md: "md", text: "txt",
  };
  const ext = extMap[lang?.toLowerCase()] || "txt";
  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `code.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

function CodeBlock({ className, children }) {
  const { copied, copy } = useCopyToClipboard();
  const lang = className?.replace("language-", "") || "text";
  const code = children != null ? String(children).replace(/\n$/, "") : "";

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <div className="code-block-dots">
          <span /><span /><span />
        </div>
        <span className="code-block-lang">{lang}</span>
        <div className="code-block-actions">
          <button className="code-action-btn" onClick={() => copy(code)} title="Copy code">
            {copied ? <><Check className="w-3 h-3" /><span>Copied</span></> : <><Copy className="w-3 h-3" /><span>Copy</span></>}
          </button>
          <button className="code-action-btn" onClick={() => downloadCode(code, lang)} title="Download">
            <Download className="w-3 h-3" /><span>Download</span>
          </button>
        </div>
      </div>
      <pre className="code-block-pre">
        <code className="code-block-code">{code}</code>
      </pre>
    </div>
  );
}

const streamingComponents = {
  h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
  h4: ({ children }) => <h4 className="md-h4">{children}</h4>,
  p: ({ children }) => <p className="md-p">{children}</p>,
  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
  li: ({ children }) => <li className="md-li">{children}</li>,
  code: ({ className, children, ...props }) => {
    const isBlock =
      /language-/.test(className || "") ||
      (typeof children === "string" && children.includes("\n"));
    if (!isBlock) return <code className="md-inline-code" {...props}>{children}</code>;
    if (children == null || children === "") return null;
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
  hr: () => <hr className="md-hr" />,
  strong: ({ children }) => <strong className="md-strong">{children}</strong>,
  em: ({ children }) => <em className="md-em">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">{children}</a>
  ),
  table: ({ children }) => (
    <div className="md-table-wrapper"><table className="md-table">{children}</table></div>
  ),
  thead: ({ children }) => <thead className="md-thead">{children}</thead>,
  tbody: ({ children }) => <tbody className="md-tbody">{children}</tbody>,
  tr: ({ children }) => <tr className="md-tr">{children}</tr>,
  th: ({ children }) => <th className="md-th">{children}</th>,
  td: ({ children }) => <td className="md-td">{children}</td>,
};

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
    <div className="ai-markdown streaming-cursor min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={streamingComponents}>
        {cleanContent(content)}
      </ReactMarkdown>
    </div>
  );
}
