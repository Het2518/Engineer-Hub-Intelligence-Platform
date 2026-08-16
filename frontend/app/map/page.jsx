"use client";

import { useState, useEffect } from "react";
import { Loader2, Search, Zap, Info, ShieldAlert, DollarSign, Activity, Skull, Cpu, GitPullRequest } from "lucide-react";
import { NeuroGraph3D } from "../../components/graph/ForceGraph3D";
import { MarkdownRenderer } from "../../components/chat/MarkdownRenderer";
import { cn } from "../../lib/utils";

export default function NeuroMapPage() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  
  // Modes: 'blast', 'gitops', 'finops'
  const [engineMode, setEngineMode] = useState("blast");
  
  // Simulation State
  const [query, setQuery] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [highlightedNodes, setHighlightedNodes] = useState([]);
  const [extractedTarget, setExtractedTarget] = useState("");

  // Auto-Remediation State
  const [isRemediating, setIsRemediating] = useState(false);
  const [remediationPlan, setRemediationPlan] = useState(null);

  // Telemetry State
  const [liveTraffic, setLiveTraffic] = useState(false);
  const [ddosMode, setDdosMode] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetch(`${apiUrl}/graph/data`)
      .then(res => res.json())
      .then(data => { setGraphData(data); setIsLoading(false); })
      .catch(err => { console.error("Failed to load graph", err); setIsLoading(false); });
  }, [apiUrl]);

  const handleSimulate = async (e, overrideQuery = null) => {
    if (e) e.preventDefault();
    const currentQuery = overrideQuery || query;
    if (!currentQuery.trim()) return;

    setIsSimulating(true);
    setSimulationResult(null);
    setRemediationPlan(null);
    setHighlightedNodes([]);
    
    let endpoint = "/graph/blast-radius";
    let bodyData = { query: currentQuery };
    
    if (engineMode === "gitops") {
      endpoint = "/graph/pr-impact";
      bodyData = { pr_url: currentQuery };
    } else if (engineMode === "finops") {
      endpoint = "/graph/finops";
    }

    try {
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      
      setSimulationResult(data.summary);
      if (data.subgraph && data.subgraph.nodes) {
        setHighlightedNodes(data.subgraph.nodes.map(n => n.id));
        setExtractedTarget(data.subgraph.nodes.length > 0 ? data.subgraph.nodes[0].id : "");
      }
    } catch (err) {
      console.error(err);
      setSimulationResult("Simulation failed due to a network error.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRemediate = async () => {
    setIsRemediating(true);
    try {
      const res = await fetch(`${apiUrl}/graph/remediate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          target_component: extractedTarget,
          blast_radius_summary: simulationResult
        }),
      });
      const data = await res.json();
      setRemediationPlan(data.remediation);
    } catch (err) {
      setRemediationPlan("Failed to generate remediation plan.");
    } finally {
      setIsRemediating(false);
    }
  };

  const triggerChaosMonkey = () => {
    if (graphData.nodes.length === 0) return;
    const randomNode = graphData.nodes[Math.floor(Math.random() * graphData.nodes.length)].id;
    setEngineMode("blast");
    setQuery(`What happens if ${randomNode} goes down completely?`);
    handleSimulate(null, `What happens if ${randomNode} goes down completely?`);
  };

  const clearSimulation = () => {
    setQuery("");
    setSimulationResult(null);
    setRemediationPlan(null);
    setHighlightedNodes([]);
  };

  return (
    <div className="flex h-full w-full relative overflow-hidden bg-[hsl(var(--background))]">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0">
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Initializing 3D Constellation...</p>
          </div>
        ) : graphData.nodes.length > 0 ? (
          <NeuroGraph3D 
            data={graphData} 
            highlightedNodes={highlightedNodes}
            liveTraffic={liveTraffic}
            ddosMode={ddosMode}
            onNodeClick={(node) => {
              setQuery(engineMode === "gitops" ? `PR updates ${node.id}` : `What if we drop ${node.id}?`);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No graph data available. Upload OKF documents.</p>
          </div>
        )}
      </div>

      {/* Floating UI Overlay - Left */}
      <div className="absolute top-6 left-6 z-10 w-[420px] flex flex-col gap-4 pointer-events-none">
        
        {/* Main Control Panel */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl p-5 shadow-lg pointer-events-auto">
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              <h1 className="font-semibold text-foreground tracking-tight">Neuro-Graph Engine</h1>
            </div>
            <button 
              onClick={() => {
                setIsLoading(true);
                fetch(`${apiUrl}/graph/data`)
                  .then(res => res.json())
                  .then(data => { setGraphData(data); setIsLoading(false); })
                  .catch(() => setIsLoading(false));
              }}
              className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
            >
              Sync Map
            </button>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg mb-4">
            <button 
              onClick={() => setEngineMode("blast")}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all", engineMode === "blast" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Blast Radius
            </button>
            <button 
              onClick={() => setEngineMode("gitops")}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all", engineMode === "gitops" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <GitPullRequest className="w-3.5 h-3.5" /> GitOps PR
            </button>
            <button 
              onClick={() => setEngineMode("finops")}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all", engineMode === "finops" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <DollarSign className="w-3.5 h-3.5" /> FinOps Cost
            </button>
          </div>
          
          <form onSubmit={(e) => handleSimulate(e)} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                engineMode === "blast" ? 'e.g., "What if we replace Redis?"' :
                engineMode === "gitops" ? 'e.g., "https://github.com/org/repo/pull/42"' :
                'e.g., "Traffic 10x on payments-api"'
              }
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
            />
            
            <div className="flex items-center gap-2 mt-3">
              <button 
                type="submit" 
                disabled={isSimulating || !query.trim()}
                className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {isSimulating ? "Simulating..." : "Run Simulation"}
              </button>
              {simulationResult && (
                <button 
                  type="button" 
                  onClick={clearSimulation}
                  className="px-3 py-2 text-xs font-medium bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

        </div>

        {/* Results Card */}
        {simulationResult && (
          <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl pointer-events-auto flex flex-col max-h-[60vh] animate-slide-up overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-secondary/20">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {engineMode === "blast" ? "Blast Radius Assessment" : engineMode === "gitops" ? "GitOps PR Impact" : "FinOps Cost Projection"}
              </h2>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar text-sm space-y-4">
              <MarkdownRenderer content={simulationResult} />
              
              {/* Remediation Section */}
              {engineMode === "blast" && !remediationPlan && (
                <div className="pt-4 mt-4 border-t border-border/50 flex justify-end">
                  <button 
                    onClick={handleRemediate}
                    disabled={isRemediating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 text-xs font-semibold rounded-md border border-blue-500/20 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                  >
                    {isRemediating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                    Generate Auto-Remediation Plan
                  </button>
                </div>
              )}
              
              {remediationPlan && (
                <div className="pt-4 mt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4 text-green-500" />
                    <h3 className="text-sm font-bold text-green-500">Architecture Refactoring Proposal</h3>
                  </div>
                  <MarkdownRenderer content={remediationPlan} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Live Telemetry Controls - Bottom Right */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col items-end gap-3 pointer-events-none">
        
        {/* Chaos Monkey */}
        <button 
          onClick={triggerChaosMonkey}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-full shadow-lg hover:shadow-orange-500/20 hover:scale-105 transition-all font-bold text-xs"
        >
          <Skull className="w-4 h-4" /> Unleash Chaos Monkey
        </button>

        {/* Telemetry Panel */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl p-3 shadow-lg pointer-events-auto min-w-[200px]">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground">Live Telemetry</h3>
          </div>
          <div className="space-y-2">
            <button 
              onClick={() => setLiveTraffic(!liveTraffic)}
              className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all", liveTraffic ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary text-muted-foreground")}
            >
              <span>Network Traffic</span>
              <div className={cn("w-2 h-2 rounded-full", liveTraffic ? "bg-primary animate-pulse" : "bg-muted")} />
            </button>
            <button 
              onClick={() => {
                if (!ddosMode) setLiveTraffic(true);
                setDdosMode(!ddosMode);
              }}
              className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all", ddosMode ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-secondary text-muted-foreground")}
            >
              <span>Simulate DDoS</span>
              <div className={cn("w-2 h-2 rounded-full", ddosMode ? "bg-red-500 animate-pulse" : "bg-muted")} />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-sm flex items-center gap-2 pointer-events-auto">
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
            Left Click: Rotate · Right Click: Pan · Scroll: Zoom
          </span>
        </div>
      </div>

    </div>
  );
}
