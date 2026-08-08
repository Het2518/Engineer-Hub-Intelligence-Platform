"use client";

import { useState, useEffect } from "react";
import {
  X, Shield, Clock, Link as LinkIcon, Tag, ExternalLink,
  BookOpen, AlertTriangle, Layers, FileText, LayoutDashboard, Activity,
  CheckCircle2, Edit3, MessageSquare, Copy, Check
} from "lucide-react";
import { OKF_TYPE_CONFIG, TRUST_CONFIG } from "./OKFDocumentCard";

// Simple markdown renderer using regex transforms
function SimpleMarkdown({ content }) {
  if (!content) return null;

  // Convert markdown to styled HTML
  const html = content
    // Code blocks
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="code-block" data-lang="${lang || ''}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
    )
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="md-h3 text-foreground font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2 text-foreground font-semibold mt-5 mb-3 text-lg">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1 text-foreground font-bold mt-6 mb-4 text-xl">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-500 hover:underline" target="_blank">$1</a>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-[hsl(var(--border))] my-4" />')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="mb-3">')
    // Wrap in paragraph
    ;

  return (
    <div
      className="prose-premium text-sm leading-relaxed text-foreground"
      dangerouslySetInnerHTML={{ __html: `<p class="mb-3">${html}</p>` }}
    />
  );
}

export function OKFDocumentViewer({ doc, onClose, onEdit }) {
  const [copied, setCopied] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState([]);

  const typeConf  = OKF_TYPE_CONFIG[doc.okf_type] || OKF_TYPE_CONFIG.Standard;
  const trustConf = TRUST_CONFIG[doc.trust_level] || TRUST_CONFIG.LOW;
  const TypeIcon  = typeConf.icon;

  useEffect(() => {
    // Fetch linked documents
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/knowledge/${encodeURIComponent(doc.source_id)}`)
      .then((r) => r.json())
      .then((data) => setLinkedDocs(data.linked_documents || []))
      .catch(() => {});
  }, [doc.source_id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(doc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAskAI = () => {
    const question = `Tell me about: ${doc.title}`;
    window.location.href = `/chat?q=${encodeURIComponent(question)}`;
  };

  return (
    <div className="flex flex-col h-full animate-slide-in-right bg-[hsl(var(--card))] border-l border-[hsl(var(--border))]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 flex-shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))]">
            <TypeIcon className="w-5 h-5 text-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-base leading-tight text-foreground">
              {doc.title}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[hsl(var(--secondary))] text-foreground border border-[hsl(var(--border))]">
                {typeConf.label}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-muted-foreground">
                {doc.trust_level === "HIGH" && <CheckCircle2 className="w-2.5 h-2.5 text-green-600 dark:text-green-500" />}
                {trustConf.label}
              </span>
              {doc.is_stale && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                  ⚠ Stale
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl transition-all duration-150 hover:scale-110 flex-shrink-0 bg-[hsl(var(--secondary))] text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metadata strip */}
      <div className="flex items-center gap-4 px-5 py-3 text-[11px] flex-shrink-0 flex-wrap border-b border-[hsl(var(--border))] text-muted-foreground bg-[hsl(var(--background))]">
        {doc.timestamp && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(doc.timestamp).toLocaleDateString()}
          </span>
        )}
        {doc.tags?.length > 0 && (
          <span className="flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {doc.tags.join(", ")}
          </span>
        )}
        {doc.resource && (
          <a
            href={doc.resource}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors hover:text-foreground underline"
          >
            <ExternalLink className="w-3 h-3" />
            Resource
          </a>
        )}
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-green-600 dark:text-green-500" />
          <span className="text-green-700 dark:text-green-400 font-medium">OKF v0.2 · {doc.category}</span>
        </span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-5 py-2.5 flex-shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <button
          onClick={handleAskAI}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-semibold transition-all duration-200 btn-primary"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Ask AI about this
        </button>
        {onEdit && (
          <button
            onClick={() => onEdit(doc)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium transition-all duration-200 border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-foreground hover:bg-[hsl(var(--border))]"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium transition-all duration-200 ml-auto border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-foreground hover:bg-[hsl(var(--border))]"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy .md"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {doc.description && (
          <p className="text-sm mb-4 italic text-muted-foreground border-l-2 border-[hsl(var(--border))] pl-3">
            {doc.description}
          </p>
        )}

        {/* Stale warning banner */}
        {doc.is_stale && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-[var(--radius)] mb-4 text-sm bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-600 dark:text-orange-500" />
            <p className="text-orange-800 dark:text-orange-300">
              This document hasn't been updated in 90+ days. Verify with the owning team before acting on it.
            </p>
          </div>
        )}

        <SimpleMarkdown content={doc.content} />

        {/* Linked documents */}
        {linkedDocs.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[hsl(var(--border))]">
            <p className="text-xs font-bold uppercase tracking-wider mb-3 text-muted-foreground">
              <LinkIcon className="w-3 h-3 inline mr-1.5" />
              Related Documents
            </p>
            <div className="space-y-2">
              {linkedDocs.map((linked) => {
                const lConf = OKF_TYPE_CONFIG[linked.okf_type] || OKF_TYPE_CONFIG.Standard;
                return (
                  <div
                    key={linked.source_id}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius)] border border-[hsl(var(--border))] text-sm cursor-pointer transition-all duration-200 hover:shadow-sm bg-[hsl(var(--secondary)/0.3)] hover:bg-[hsl(var(--secondary))]"
                  >
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-foreground">
                      {lConf.label}
                    </span>
                    <span className="text-foreground font-medium">{linked.title}</span>
                    <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
