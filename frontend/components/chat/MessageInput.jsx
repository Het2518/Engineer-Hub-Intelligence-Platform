"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "../../lib/utils";

export function MessageInput({ onSend, isLoading, onStop }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isLoading, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e) => {
    setValue(e.target.value);
    // Auto-resize
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  };

  return (
    <div className="p-4 border-t border-border bg-background">
      <div
        className={cn(
          "flex items-end gap-3 px-4 py-3 rounded-2xl border transition-all duration-200",
          "bg-card border-border shadow-sm",
          "focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]"
        )}
      >
        {/* Textarea */}
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask about authentication, deployments, incidents, runbooks..."
          rows={1}
          className={cn(
            "flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground",
            "resize-none outline-none border-none",
            "min-h-[24px] max-h-[200px] leading-6"
          )}
          disabled={isLoading && false} // Allow typing during stream
        />

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isLoading ? (
            <button
              onClick={onStop}
              className="w-8 h-8 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-all duration-200 shadow-sm"
              title="Stop generation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim()}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
                value.trim()
                  ? "bg-primary hover:bg-secondary text-primary-foreground shadow-md shadow-primary/25"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/60 mt-2 font-medium">
        Press <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground text-[9px]">Enter</kbd> to send
        {" · "}
        <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground text-[9px]">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
