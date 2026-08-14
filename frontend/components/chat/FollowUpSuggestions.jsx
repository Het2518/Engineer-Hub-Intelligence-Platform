"use client";

import { useState, useEffect } from "react";
import { Sparkles, ArrowRight, RefreshCw } from "lucide-react";
import { API_BASE } from "../../lib/constants";

/** Animated follow-up question suggestions shown after every AI answer. */
export function FollowUpSuggestions({ question, answer, sources = [], onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!answer || answer.length < 20) return;
    let cancelled = false;
    setLoading(true);
    setVisible(false);
    setSuggestions([]);

    // Generate follow-up questions on the client side using a simple heuristic
    // (avoids extra API call — can be upgraded to a real /chat/suggestions endpoint)
    const generated = generateLocalSuggestions(question, answer, sources);
    setTimeout(() => {
      if (cancelled) return;
      setSuggestions(generated);
      setLoading(false);
      setTimeout(() => setVisible(true), 100);
    }, 400);

    return () => { cancelled = true; };
  }, [answer]);

  if (loading || suggestions.length === 0) return null;

  return (
    <div
      className={`mt-3 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-[0.7rem] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Follow up
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {suggestions.map((s, i) => (
          <button
            key={i}
            id={`followup-suggestion-${i}`}
            onClick={() => onSelect?.(s)}
            className="group flex items-center gap-2 text-left w-full rounded-lg px-3 py-2
              text-[0.8125rem] text-muted-foreground hover:text-foreground
              bg-muted/30 hover:bg-primary/8 border border-border/0 hover:border-primary/20
              transition-all duration-200 cursor-pointer"
          >
            <ArrowRight className="w-3 h-3 text-primary/50 group-hover:text-primary shrink-0 transition-colors" />
            <span>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Generate contextual follow-up questions without an extra API call.
 * Combines question-type heuristics with source topic extraction.
 */
function generateLocalSuggestions(question, answer, sources) {
  const q = question.toLowerCase();
  const suggestions = [];

  // Extract source topics
  const sourceTopics = sources
    .slice(0, 3)
    .map((s) => s.filename?.replace(/\.(pdf|md|txt|docx)$/i, "").replace(/[-_]/g, " "))
    .filter(Boolean);

  // Pattern-based suggestions
  if (q.includes("error") || q.includes("fail") || q.includes("issue") || q.includes("bug")) {
    suggestions.push("What is the root cause of this error?");
    suggestions.push("Is there a runbook or playbook that covers this?");
  }
  if (q.includes("how to") || q.includes("setup") || q.includes("install") || q.includes("configure")) {
    suggestions.push("What are common mistakes when doing this?");
    suggestions.push("Are there any prerequisites I should know about?");
  }
  if (q.includes("what is") || q.includes("define") || q.includes("explain")) {
    suggestions.push("Can you give a practical example of this?");
    suggestions.push("How does this compare to similar alternatives?");
  }
  if (q.includes("incident") || q.includes("outage") || q.includes("alert")) {
    suggestions.push("What was the impact and affected services?");
    suggestions.push("What mitigations were applied?");
  }

  // Source-based suggestions
  if (sourceTopics.length > 0) {
    suggestions.push(`Tell me more about ${sourceTopics[0]}`);
  }

  // Generic fallbacks based on answer content
  if (answer.includes("however") || answer.includes("but") || answer.includes("limitation")) {
    suggestions.push("What are the limitations or trade-offs here?");
  }
  if (answer.includes("step") || answer.includes("first") || answer.includes("then")) {
    suggestions.push("Can you summarize the key steps?");
  }

  // Deduplicate and cap at 3
  return [...new Set(suggestions)].slice(0, 3);
}
