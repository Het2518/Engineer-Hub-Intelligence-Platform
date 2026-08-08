"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { StreamingMessage } from "./StreamingMessage";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { AlertCircle, ChevronDown, ChevronUp, FileText } from "lucide-react";

/* ─── Main export ─────────────────────────────────────────────── */
export function MessageList({ messages, isThinking, thinkingMeta }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center h-full animate-fade-in">
        <h1 className="text-[1.35rem] font-semibold mb-1.5 tracking-tight text-foreground">
          Engineer Hub
        </h1>
        <p className="text-[0.875rem] text-muted-foreground mb-10 max-w-sm leading-relaxed">
          Ask about your systems, code, incidents, architecture or knowledge base.
        </p>
        <div className="flex items-center justify-center gap-6">
          {EXAMPLE_QUESTIONS.map((q) => (
            <ExampleQuestion key={q.label} label={q.label} query={q.query} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center scrollbar-none">
      <div className="w-full max-w-[46rem] space-y-10">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isThinking && (
          <ThinkingIndicator
            okfSources={thinkingMeta?.okf_sources || 0}
            ragSources={thinkingMeta?.rag_sources || 0}
            total={thinkingMeta?.total || 0}
          />
        )}

        <div ref={bottomRef} className="pb-12" />
      </div>
    </div>
  );
}

/* ─── Example question buttons ────────────────────────────────── */
function ExampleQuestion({ label, query }) {
  return (
    <button
      className="text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground underline decoration-transparent hover:decoration-muted-foreground/30 underline-offset-4"
      onClick={() => {
        const input = document.querySelector("#chat-input");
        if (input) {
          input.value = query;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
        }
      }}
    >
      {label}
    </button>
  );
}

const EXAMPLE_QUESTIONS = [
  { label: "Database", query: "How should I safely roll back a DB migration?" },
  { label: "Architecture", query: "Explain our API versioning standard." },
  { label: "Incidents", query: "What caused the Q2 database outage?" },
];

/* ─── Source strip — compact, expandable ──────────────────────── */
const MAX_VISIBLE_SOURCES = 3;

function SourceStrip({ sources }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  // Sort by confidence desc, dedupe by filename
  const seen = new Set();
  const sorted = [...sources]
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .filter((s) => {
      const key = s.filename;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const visible = expanded ? sorted : sorted.slice(0, MAX_VISIBLE_SOURCES);
  const hasMore = sorted.length > MAX_VISIBLE_SOURCES;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-1.5 items-center">
        {visible.map((source, i) => (
          <SourcePill key={`src-${i}`} source={source} />
        ))}
        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-0.5 text-[0.7rem] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors px-1.5 py-0.5"
          >
            {expanded ? (
              <><ChevronUp className="w-3 h-3" /> less</>
            ) : (
              <><ChevronDown className="w-3 h-3" /> +{sorted.length - MAX_VISIBLE_SOURCES} more</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Individual source pill ──────────────────────────────────── */
function SourcePill({ source }) {
  const isOKF = source.is_okf === true;
  const shortName = (source.filename?.split("/").pop() || source.filename || "Source")
    .replace(/\.[^.]+$/, ""); // strip extension for cleanliness

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[0.7rem] font-medium px-2 py-0.5 rounded-full cursor-default transition-colors",
        "bg-[hsl(var(--secondary)/0.6)] text-muted-foreground border",
        isOKF
          ? "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]"
          : "border-transparent hover:bg-[hsl(var(--secondary))]"
      )}
      title={source.content_preview || source.filename}
    >
      {shortName}
      {source.confidence ? (
        <span className="opacity-40 font-mono">{source.confidence}%</span>
      ) : null}
    </span>
  );
}

/* ─── Message bubble ──────────────────────────────────────────── */
function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const sources = message.sources || [];

  return (
    <div
      className={cn(
        "flex flex-col gap-1 w-full animate-slide-up",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div className={cn("max-w-full", isUser ? "w-auto max-w-[85%]" : "w-full")}>
        {/* Source strip — only for assistant messages */}
        {!isUser && sources.length > 0 && <SourceStrip sources={sources} />}

        {/* Message content */}
        <div
          className={cn(
            "text-[0.9375rem] leading-relaxed",
            isUser
              ? "bg-[hsl(var(--secondary)/0.4)] text-foreground px-5 py-3 rounded-2xl rounded-tr-sm"
              : "w-full px-0 text-foreground"
          )}
        >
          {isUser ? (
            <div className="flex flex-col gap-2">
              {message.attachedFile && (
                <div className="flex items-center gap-2 px-3 py-2 bg-background/50 rounded-lg w-max border border-[hsl(var(--border))]">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[0.8125rem] font-medium text-foreground max-w-[200px] truncate">
                    {message.attachedFile.filename}
                  </span>
                </div>
              )}
              {message.content && (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          ) : message.error ? (
            <div className="flex items-start gap-2 text-red-500/80">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Error</p>
                <p className="text-xs mt-0.5 opacity-80">{message.error}</p>
              </div>
            </div>
          ) : message.isStreaming ? (
            <StreamingMessage content={message.content} />
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        {/* Response timing — quiet, at the bottom */}
        {!isUser && message.response_time_ms && !message.isStreaming && (
          <div className="mt-3">
            <span className="text-[0.65rem] font-medium text-muted-foreground/40 tabular-nums">
              {message.response_time_ms.toFixed(0)}ms
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
