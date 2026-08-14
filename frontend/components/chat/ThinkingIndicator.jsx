"use client";

import { useEffect, useState } from "react";
import { Zap, Brain, Database, Cpu, CheckCircle } from "lucide-react";

const STAGES = [
  { id: "routing",   icon: Brain,    label: "Routing query",          duration: 300  },
  { id: "cache",     icon: Zap,      label: "Checking cache",         duration: 200  },
  { id: "retrieval", icon: Database, label: "Searching knowledge base", duration: 1200 },
  { id: "ranking",   icon: Cpu,      label: "Ranking results",        duration: 400  },
  { id: "generating",icon: Brain,    label: "Generating answer",      duration: null }, // lasts until done
];

export function ThinkingIndicator({
  okfSources = 0,
  ragSources = 0,
  total = 0,
  tier = "normal",
  isCacheHit = false,
}) {
  const [currentStage, setCurrentStage] = useState(0);
  const [completedStages, setCompletedStages] = useState([]);

  useEffect(() => {
    if (isCacheHit) {
      // Skip directly to "done" for cache hits
      setCompletedStages(STAGES.map((_, i) => i));
      return;
    }

    let idx = 0;
    const timers = [];

    const advance = () => {
      if (idx >= STAGES.length - 1) return;
      const stage = STAGES[idx];
      if (stage.duration) {
        const t = setTimeout(() => {
          setCompletedStages((prev) => [...prev, idx]);
          idx += 1;
          setCurrentStage(idx);
          advance();
        }, stage.duration);
        timers.push(t);
      }
    };

    advance();
    return () => timers.forEach(clearTimeout);
  }, [isCacheHit]);

  if (isCacheHit) {
    return (
      <div className="flex items-center gap-2 py-1 px-1 animate-fade-in">
        <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
        <span className="text-[0.8125rem] text-amber-400 font-semibold tracking-wide">
          Instant — served from cache
        </span>
      </div>
    );
  }

  const active = STAGES[currentStage];
  const Icon = active?.icon ?? Brain;

  return (
    <div className="flex flex-col gap-2 py-1 px-1 animate-fade-in">
      {/* Pipeline stage track */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {STAGES.map((stage, i) => {
          const SIcon = stage.icon;
          const done = completedStages.includes(i);
          const active_ = currentStage === i && !done;
          return (
            <div
              key={stage.id}
              className="flex items-center gap-1"
            >
              <div
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium transition-all duration-300
                  ${done   ? "bg-green-500/15 text-green-400"
                  : active_ ? "bg-primary/15 text-primary"
                  :           "text-muted-foreground/30"}`}
              >
                {done
                  ? <CheckCircle className="w-3 h-3" />
                  : <SIcon className={`w-3 h-3 ${active_ ? "animate-pulse" : ""}`} />
                }
                <span className="whitespace-nowrap hidden sm:inline">{stage.label}</span>
              </div>
              {i < STAGES.length - 1 && (
                <div className={`w-3 h-px ${done ? "bg-green-500/40" : "bg-border/30"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Status text */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {[0, 160, 320].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-primary/40"
              style={{ animation: `pulse 1.4s ease-in-out infinite`, animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        <span className="text-[0.8125rem] text-muted-foreground/60 font-medium">
          {total > 0
            ? `Searching ${total} source${total !== 1 ? "s" : ""}${tier === "fast" ? " (fast path)" : tier === "complex" ? " (deep analysis)" : ""}…`
            : "Thinking…"}
        </span>
        {tier === "fast" && (
          <span className="text-[0.65rem] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
            Fast
          </span>
        )}
        {tier === "complex" && (
          <span className="text-[0.65rem] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">
            Deep
          </span>
        )}
      </div>
    </div>
  );
}
