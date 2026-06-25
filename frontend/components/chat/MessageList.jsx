"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "../../lib/utils";
import { StreamingMessage } from "./StreamingMessage";
import { SourceCard } from "./SourceCard";
import {
  User,
  Cpu,
  AlertCircle,
  Zap,
  ArrowRight,
  Copy,
  Check,
  Download,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─── Strip leaked knowledge_cards JSON from content ─────────────────────── */
// The backend sometimes appends raw JSON to the streamed text.
// This regex removes any trailing knowledge_cards block before rendering.
function cleanContent(raw) {
  if (!raw) return "";
  // Remove standalone JSON arrays at end (knowledge_cards leak)
  return raw
    // Remove lines that are just [ or ] surrounding a JSON card array
    .replace(/\n?knowledge_cards\s*\n[\s\S]*$/i, "")
    // Remove any trailing bare JSON array like \n[\n  {...}\n]
    .replace(/\n\[\n[\s\S]*?\]\s*$/g, "")
    // Remove SOURCE: references that got streamed into content
    .replace(/\[SOURCE:[^\]]+\]/g, "")
    .trimEnd();
}

/* ─── Copy-to-clipboard hook ──────────────────────────────────────────────── */
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

/* ─── Download-as-file helper ─────────────────────────────────────────────── */
function downloadCode(code, lang) {
  const extMap = {
    javascript: "js", js: "js", typescript: "ts", ts: "ts",
    python: "py", py: "py", java: "java", kotlin: "kt",
    go: "go", rust: "rs", cpp: "cpp", c: "c", cs: "cs",
    html: "html", css: "css", scss: "scss", json: "json",
    yaml: "yaml", yml: "yml", toml: "toml", bash: "sh",
    sh: "sh", shell: "sh", sql: "sql", graphql: "graphql",
    gql: "graphql", dockerfile: "dockerfile", xml: "xml",
    markdown: "md", md: "md", swift: "swift", dart: "dart",
    php: "php", ruby: "rb", rb: "rb", r: "r", scala: "scala",
    haskell: "hs", lua: "lua", perl: "pl", text: "txt",
  };
  const ext = extMap[lang?.toLowerCase()] || "txt";
  const filename = `code.${ext}`;
  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Code block component ──────────────────────────────────────────── */
function CodeBlock({ className, children }) {
  const { copied, copy } = useCopyToClipboard();
  const lang = className?.replace("language-", "") || "text";
  // Guard: children may be undefined when react-markdown passes empty nodes
  const code = children != null ? String(children).replace(/\n$/, "") : "";

  return (
    <div className="code-block-wrapper">
      {/* Header bar */}
      <div className="code-block-header">
        <div className="code-block-dots">
          <span />
          <span />
          <span />
        </div>
        <span className="code-block-lang">{lang}</span>
        <div className="code-block-actions">
          <button
            className="code-action-btn"
            onClick={() => copy(code)}
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            className="code-action-btn"
            onClick={() => downloadCode(code, lang)}
            title="Download as file"
          >
            <Download className="w-3 h-3" />
            <span>Download</span>
          </button>
        </div>
      </div>
      {/* Code area */}
      <pre className="code-block-pre">
        <code className="code-block-code">{code}</code>
      </pre>
    </div>
  );
}

/* ─── Markdown component overrides ────────────────────────────────────────── */
const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="md-h1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="md-h2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="md-h3">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="md-h4">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="md-h5">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="md-h6">{children}</h6>
  ),

  p: ({ children }) => (
    <p className="md-p">{children}</p>
  ),

  ul: ({ children }) => (
    <ul className="md-ul">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="md-ol">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="md-li">{children}</li>
  ),

  /* Inline vs block code — react-markdown v10 removed the `inline` prop.
   * Detect block code by: language class present OR content has newlines.
   * Everything else is inline. */
  code: ({ className, children, ...props }) => {
    const isBlock =
      /language-/.test(className || "") ||
      (typeof children === "string" && children.includes("\n"));

    if (!isBlock) {
      return (
        <code className="md-inline-code" {...props}>
          {children}
        </code>
      );
    }
    // Only render code block if there's actual content
    if (children == null || children === "") return null;
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },

  pre: ({ children }) => <>{children}</>,

  blockquote: ({ children }) => (
    <blockquote className="md-blockquote">{children}</blockquote>
  ),

  hr: () => <hr className="md-hr" />,

  strong: ({ children }) => (
    <strong className="md-strong">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="md-em">{children}</em>
  ),

  del: ({ children }) => (
    <del className="md-del">{children}</del>
  ),

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="md-link"
    >
      {children}
    </a>
  ),

  table: ({ children }) => (
    <div className="md-table-wrapper">
      <table className="md-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="md-thead">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="md-tbody">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="md-tr">{children}</tr>,
  th: ({ children }) => <th className="md-th">{children}</th>,
  td: ({ children }) => <td className="md-td">{children}</td>,

  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt || ""}
      className="md-img"
      loading="lazy"
    />
  ),
};

/* ─── Main export ──────────────────────────────────────────────────────────── */
export function MessageList({ messages, onExampleClick }) {
  const bottomRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Render empty state until mounted to match server output and avoid hydration mismatch
  if (!mounted || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        {/* Logo mark */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex items-center justify-center mb-5 shadow-md shadow-primary/5">
          <Cpu className="w-7 h-7 text-primary/70" strokeWidth={1.5} />
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-1.5 tracking-tight">
          Engineering Intelligence Hub
        </h2>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed mb-7">
          Ask questions about your docs, runbooks, incident reports, and code repositories.
        </p>

        {/* Example prompts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
          {EXAMPLE_QUESTIONS.map((q) => (
            <ExampleQuestion key={q} question={q} onExampleClick={onExampleClick} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

/* ─── Example prompt button ────────────────────────────────────────────────── */
function ExampleQuestion({ question, onExampleClick }) {
  return (
    <button
      onClick={() => onExampleClick?.(question)}
      className="group text-left px-3.5 py-2.5 rounded-xl text-xs text-muted-foreground border border-border/60 hover:border-primary/30 hover:bg-primary/5 hover:text-foreground transition-all duration-150 flex items-center justify-between gap-2"
    >
      <span>{question}</span>
      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
    </button>
  );
}

const EXAMPLE_QUESTIONS = [
  "How does authentication work?",
  "What caused the last production outage?",
  "Where is the payment service deployed?",
  "How do I fix a CrashLoopBackOff?",
  "Which service owns billing?",
  "What is the onboarding process?",
];

/* ─── Message bubble ───────────────────────────────────────────────────────── */
function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 animate-slide-in", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <Avatar isUser={isUser} />

      <div className={cn("flex-1 min-w-0 max-w-3xl", isUser && "flex justify-end")}>
        {/* User bubble has a styled card; AI responses render directly on background */}
        {isUser ? (
          <div className="user-bubble">
            <BubbleContent message={message} isUser={true} />
          </div>
        ) : (
          <div className="ai-response">
            <BubbleContent message={message} isUser={false} />
          </div>
        )}

        {/* Metadata row — sources, cards, timing */}
        {!isUser && <MessageMeta message={message} />}
      </div>
    </div>
  );
}

/* ─── Avatar ───────────────────────────────────────────────────────────────── */
function Avatar({ isUser }) {
  return (
    <div
      className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
        isUser
          ? "bg-primary/20 border border-primary/25"
          : "bg-muted border border-border/60"
      )}
    >
      {isUser ? (
        <User className="w-3.5 h-3.5 text-primary" />
      ) : (
        <Cpu className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
      )}
    </div>
  );
}

/* ─── Bubble content ───────────────────────────────────────────────────────── */
function BubbleContent({ message, isUser }) {
  if (isUser) {
    return <p className="whitespace-pre-wrap leading-6 text-sm">{message.content}</p>;
  }

  if (message.error) {
    return (
      <div className="flex items-start gap-2.5 text-destructive">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-sm">Something went wrong</p>
          <p className="text-xs mt-1 text-destructive/70">{message.error}</p>
        </div>
      </div>
    );
  }

  if (message.isStreaming) {
    return <StreamingMessage content={message.content} />;
  }

  // Finished assistant message — render full markdown (cleaned)
  return (
    <div className="ai-markdown min-w-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {cleanContent(message.content)}
      </ReactMarkdown>
    </div>
  );
}

/* ─── Below-bubble metadata ────────────────────────────────────────────────── */
function MessageMeta({ message }) {
  const hasSources = message.sources?.length > 0;
  const hasTiming = message.response_time_ms && !message.isStreaming;

  if (!hasSources && !hasTiming) return null;

  return (
    <div className="mt-3 space-y-2 px-1">
      {/* Sources */}
      {hasSources && (
        <div>
          <SectionLabel>Sources</SectionLabel>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {message.sources.map((source, i) => (
              <SourceCard key={i} source={source} />
            ))}
          </div>
        </div>
      )}

      {/* Timing */}
      {hasTiming && (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground/40 font-medium">
          <Zap className="w-3 h-3" />
          {message.response_time_ms.toFixed(0)} ms
        </p>
      )}
    </div>
  );
}

/* ─── Tiny label above metadata sections ──────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
      {children}
    </p>
  );
}