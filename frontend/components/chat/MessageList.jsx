"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "../../lib/utils";
import { StreamingMessage } from "./StreamingMessage";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { FollowUpSuggestions } from "./FollowUpSuggestions";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
  Timer,
  BookOpen,
  Cpu,
} from "lucide-react";

/* ─── Main export ──────────────────────────────────────────────────────────── */
export function MessageList({
  messages,
  isThinking,
  thinkingMeta,
  isCacheHit = false,
  onFollowUp,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center h-full animate-fade-in">
        <div className="mb-6 relative">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Cpu className="w-3 h-3 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-[1.35rem] font-semibold mb-1.5 tracking-tight text-foreground">
          Engineer Hub
        </h1>
        <p className="text-[0.875rem] text-muted-foreground mb-10 max-w-sm leading-relaxed">
          Ask about your systems, code, incidents, architecture or knowledge base.
        </p>
        <div className="flex items-center justify-center gap-6">
          {EXAMPLE_QUESTIONS.map((q) => (
            <ExampleQuestion key={q.label} label={q.label} query={q.query} icon={q.icon} />
          ))}
        </div>

        {/* V3 badges */}
        <div className="mt-12 flex items-center gap-3 text-[0.7rem] text-muted-foreground/40">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400/60" /> Semantic cache
          </span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
          <span>Hybrid RAG v3</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
          <span>Groq specdec · 1600 tok/s</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center scrollbar-none">
      <div className="w-full max-w-[46rem] space-y-10">
        {messages.map((message, idx) => (
          <MessageBubble
            key={message.id}
            message={message}
            onFollowUp={onFollowUp}
            isLastAssistant={
              !message.isStreaming &&
              message.role === "assistant" &&
              idx === messages.length - 1
            }
          />
        ))}

        {/* Thinking / pipeline visualization */}
        {isThinking && (
          <ThinkingIndicator
            okfSources={thinkingMeta?.okf_sources || 0}
            ragSources={thinkingMeta?.rag_sources || 0}
            total={thinkingMeta?.total || 0}
            tier={thinkingMeta?.tier || "normal"}
            isCacheHit={isCacheHit}
          />
        )}

        <div ref={bottomRef} className="pb-12" />
      </div>
    </div>
  );
}

/* ─── Example question buttons ─────────────────────────────────────────────── */
const EXAMPLE_QUESTIONS = [
  { label: "Database", query: "How should I safely roll back a DB migration?", icon: "🗄️" },
  { label: "Architecture", query: "Explain our API versioning standard.", icon: "🏗️" },
  { label: "Incidents", query: "What caused the Q2 database outage?", icon: "🔥" },
];

function ExampleQuestion({ label, query, icon }) {
  return (
    <button
      className="group flex flex-col items-center gap-2 text-[0.8125rem] font-medium text-muted-foreground
        transition-all hover:text-foreground"
      onClick={() => {
        const input = document.querySelector("#chat-input");
        if (input) {
          input.value = query;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
        }
      }}
    >
      <span className="text-xl">{icon}</span>
      <span className="underline decoration-transparent group-hover:decoration-muted-foreground/30 underline-offset-4">
        {label}
      </span>
    </button>
  );
}

/* ─── Source strip — compact, expandable ───────────────────────────────────── */
const MAX_VISIBLE_SOURCES = 3;

function SourceStrip({ sources }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

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

/* ─── Individual source pill ───────────────────────────────────────────────── */
function SourcePill({ source }) {
  const isOKF = source.is_okf === true;
  const shortName = (source.filename?.split("/").pop() || source.filename || "Source")
    .replace(/\.[^.]+$/, "");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[0.7rem] font-medium px-2 py-0.5 rounded-full cursor-default transition-colors",
        "bg-[hsl(var(--secondary)/0.6)] text-muted-foreground border",
        isOKF
          ? "border-amber-500/30 hover:bg-amber-500/8"
          : "border-transparent hover:bg-[hsl(var(--secondary))]"
      )}
      title={source.content_preview || source.filename}
    >
      {isOKF && <span className="text-amber-400">◆</span>}
      {shortName}
      {source.confidence ? (
        <span className="opacity-40 font-mono">{source.confidence}%</span>
      ) : null}
    </span>
  );
}

/* ─── Response metadata row ────────────────────────────────────────────────── */
function ResponseMeta({ message }) {
  if (!message.response_time_ms || message.isStreaming) return null;

  const ms = Math.round(message.response_time_ms);
  const isCacheHit = message.cache_hit;
  const tier = message.tier;

  return (
    <div className="mt-3 flex items-center gap-2.5 flex-wrap">
      {/* Time */}
      <span className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground/40 tabular-nums">
        <Timer className="w-3 h-3" />
        {ms}ms
      </span>

      {/* Cache hit badge */}
      {isCacheHit && (
        <span className="flex items-center gap-1 text-[0.65rem] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
          <Zap className="w-2.5 h-2.5 fill-amber-400" />
          Cache hit
        </span>
      )}

      {/* Routing tier badge */}
      {tier === "fast" && !isCacheHit && (
        <span className="text-[0.65rem] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
          Fast path
        </span>
      )}
      {tier === "complex" && (
        <span className="text-[0.65rem] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400">
          Deep analysis
        </span>
      )}
    </div>
  );
}

/* ─── Message bubble ───────────────────────────────────────────────────────── */
function MessageBubble({ message, onFollowUp, isLastAssistant = false }) {
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

        {/* Response metadata (time, cache badge, tier) */}
        {!isUser && <ResponseMeta message={message} />}

        {/* Follow-up suggestions — only on the last completed assistant message */}
        {!isUser && isLastAssistant && message.content && !message.isStreaming && (
          <FollowUpSuggestions
            question={message.content}
            answer={message.content}
            sources={sources}
            onSelect={onFollowUp}
          />
        )}
      </div>
    </div>
  );
}
