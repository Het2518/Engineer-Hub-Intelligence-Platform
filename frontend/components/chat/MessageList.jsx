"use client";

import { useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { StreamingMessage } from "./StreamingMessage";
import { SourceCard } from "./SourceCard";
import { KnowledgeCard } from "./KnowledgeCard";
import { User, Brain, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MessageList({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
          <Brain className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Engineering Intelligence Hub
        </h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed mb-6 font-medium">
          Ask questions about your engineering knowledge base — docs, runbooks, incident reports, and code repositories.
        </p>
        <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
          {EXAMPLE_QUESTIONS.map((q) => (
            <ExampleQuestion key={q} question={q} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function ExampleQuestion({ question }) {
  return (
    <button
      className="text-left px-3 py-2 rounded-xl text-xs text-muted-foreground/80 border border-border hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all duration-200 glass shadow-sm"
      onClick={() => {
        const input = document.querySelector("#chat-input");
        if (input) {
          input.value = question;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
        }
      }}
    >
      {question}
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

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-slide-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-sm",
          isUser
            ? "bg-primary/20 border border-primary/30"
            : "bg-secondary/20 border border-secondary/30"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary" />
        ) : (
          <Brain className="w-4 h-4 text-secondary" />
        )}
      </div>

      <div className={cn("flex-1 min-w-0 max-w-3xl", isUser && "flex justify-end")}>
        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm shadow-sm",
            isUser
              ? "bg-primary border border-primary text-primary-foreground max-w-xl"
              : "glass text-foreground w-full"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : message.error ? (
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Error</p>
                <p className="text-xs mt-1 text-destructive/80">{message.error}</p>
              </div>
            </div>
          ) : message.isStreaming ? (
            <StreamingMessage content={message.content} />
          ) : (
            <div className="prose-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, i) => (
                <SourceCard key={i} source={source} />
              ))}
            </div>
          </div>
        )}

        {/* Knowledge Cards */}
        {!isUser && message.knowledge_cards && message.knowledge_cards.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Key Concepts
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {message.knowledge_cards.map((card, i) => (
                <KnowledgeCard key={i} card={card} />
              ))}
            </div>
          </div>
        )}

        {/* Timing */}
        {!isUser && message.response_time_ms && !message.isStreaming && (
          <p className="text-[10px] text-muted-foreground/60 mt-2 px-1 font-medium">
            ⚡ {message.response_time_ms.toFixed(0)}ms
          </p>
        )}
      </div>
    </div>
  );
}
