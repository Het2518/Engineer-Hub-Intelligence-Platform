"use client";

import { useEffect, useState } from "react";
import { Zap, Brain, Database, Cpu, CheckCircle, Component, Layers, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function ThinkingIndicator({
  okfSources = 0,
  ragSources = 0,
  total = 0,
  tier = "normal",
  isCacheHit = false,
  agentState = null,
}) {
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

  // Determine icon based on state
  let Icon = Brain;
  if (agentState) {
    const s = agentState.toLowerCase();
    if (s.includes("search")) Icon = Database;
    else if (s.includes("render")) Icon = Component;
    else if (s.includes("orchestrat")) Icon = Layers;
    else if (s.includes("synthesiz")) Icon = Cpu;
  }

  return (
    <div className="flex flex-col gap-3 py-2 px-1 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75"></div>
          <div className="relative bg-[hsl(var(--secondary))] border border-primary/30 p-1.5 rounded-full">
            <Icon className="w-4 h-4 text-primary animate-pulse" />
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-[0.875rem] font-semibold text-foreground/90 flex items-center gap-2">
            {agentState || "Initializing Agent Swarm..."}
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/50" />
          </span>
          <span className="text-[0.7rem] text-muted-foreground/70">
            {total > 0 ? `Active context: ${total} sources` : "Analyzing intent and selecting tools"}
          </span>
        </div>
      </div>
    </div>
  );
}
