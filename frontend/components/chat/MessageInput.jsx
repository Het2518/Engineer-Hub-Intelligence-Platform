"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Square, Paperclip, FileText, X, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api";

export function MessageInput({ onSend, isLoading, onStop }) {
  const [value, setValue] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && !attachedFile) || isLoading || isUploading) return;
    
    onSend(trimmed, attachedFile);
    setValue("");
    setAttachedFile(null);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, attachedFile, isLoading, isUploading, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e) => {
    setValue(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 250) + "px";
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      
      // Extract text for immediate chat context
      const parsed = await api.parseChatFile(file);
      
      // Concurrently upload to the knowledge base (RAG/OKF) in the background
      api.uploadFile(file).catch(err => console.warn("Background upload to knowledge base failed:", err));

      setAttachedFile({
        filename: parsed.filename,
        content: parsed.content,
        mime_type: parsed.mime_type
      });
    } catch (err) {
      console.error("Failed to parse file", err);
      alert(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full bg-background pt-2 pb-8 px-4">
      <div className="max-w-[46rem] mx-auto relative">
        <div
          className={cn(
            "flex flex-col px-4 py-3.5 rounded-2xl border transition-all duration-300",
            "bg-[hsl(var(--card))] border-[hsl(var(--border))] shadow-sm",
            "focus-within:border-[hsl(var(--muted-foreground)/0.4)] focus-within:shadow-md"
          )}
        >
          {/* Attached File Pill */}
          {isUploading ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--secondary))] rounded-lg w-max mb-2 animate-fade-in border border-[hsl(var(--border))]">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              <span className="text-sm font-medium text-muted-foreground">Extracting text...</span>
            </div>
          ) : attachedFile ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--secondary))] rounded-lg w-max mb-2 animate-fade-in border border-[hsl(var(--border))] shadow-sm group">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground max-w-[200px] truncate">
                {attachedFile.filename}
              </span>
              <button 
                onClick={() => setAttachedFile(null)} 
                className="p-0.5 hover:bg-[hsl(var(--muted-foreground)/0.2)] rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}

          <div className="flex items-end gap-3 w-full">
            {/* Attachment Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading}
              className="w-8 h-8 rounded-full flex flex-shrink-0 items-center justify-center transition-colors hover:bg-[hsl(var(--secondary))] text-muted-foreground hover:text-foreground disabled:opacity-50"
              title="Attach document for this chat"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md,.json,.csv"
            />

            {/* Textarea */}
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={value}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className={cn(
                "flex-1 bg-transparent text-[0.9375rem] text-foreground placeholder:text-muted-foreground/70",
                "resize-none outline-none border-none",
                "min-h-[24px] max-h-[250px] leading-relaxed py-1.5",
                "scrollbar-none"
              )}
              style={{ scrollbarWidth: 'none' }}
              disabled={isLoading && false}
            />

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 mb-1">
              {isLoading ? (
                <button
                  onClick={onStop}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 bg-foreground text-background hover:opacity-90"
                  title="Stop generation"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={(!value.trim() && !attachedFile) || isUploading}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150",
                    (value.trim() || attachedFile) && !isUploading
                      ? "bg-foreground text-background hover:opacity-90 shadow-sm"
                      : "bg-[hsl(var(--secondary))] text-muted-foreground cursor-not-allowed opacity-70"
                  )}
                  title="Send message"
                >
                  <Send className="w-3.5 h-3.5 ml-0.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-[0.6875rem] text-muted-foreground/60 mt-3 font-medium">
          Axiom can make mistakes. Verify critical engineering decisions.
        </p>
      </div>
    </div>
  );
}
