"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

// Dynamically import the 3D graph to prevent SSR hydration errors with Three.js
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[hsl(var(--background))]">
      <div className="animate-pulse text-muted-foreground text-sm">Loading 3D Engine...</div>
    </div>
  ),
});

export function NeuroGraph3D({ data, width, height, onNodeClick, highlightedNodes = [], liveTraffic = false, ddosMode = false }) {
  const { resolvedTheme } = useTheme();
  const graphRef = useRef(null);

  const isDark = resolvedTheme === "dark";
  const bgColor = isDark ? "#0A0C10" : "#F7F7F8";
  
  // Style nodes
  const getNodeColor = (node) => {
    if (highlightedNodes.includes(node.id)) {
      return isDark ? "#00e5ff" : "#0055ff"; // Highlighted (cyan/blue)
    }
    if (ddosMode && Math.random() > 0.7) {
      return "#ff0000"; // Flicker red during DDoS
    }
    // Base colors by type (heuristic)
    if (node.id.includes("api") || node.id.includes("gateway")) return "#ff5555";
    if (node.id.includes("db") || node.id.includes("data")) return "#55ff55";
    if (node.id.includes("runbook") || node.id.includes("playbook")) return "#ffff55";
    return isDark ? "#888888" : "#555555"; // Default
  };

  useEffect(() => {
    if (graphRef.current && highlightedNodes.length > 0) {
      // Focus camera on the first highlighted node
      const targetNode = data.nodes.find(n => n.id === highlightedNodes[0]);
      if (targetNode && targetNode.x !== undefined) {
        // Distance from node
        const distance = 100;
        const distRatio = 1 + distance/Math.hypot(targetNode.x, targetNode.y, targetNode.z);
        
        graphRef.current.cameraPosition(
          { x: targetNode.x * distRatio, y: targetNode.y * distRatio, z: targetNode.z * distRatio }, // new position
          targetNode, // lookAt
          2000  // ms transition
        );
      }
    }
  }, [highlightedNodes, data]);

  // Telemetry logic
  const particleCount = liveTraffic ? (ddosMode ? 4 : 2) : 0;
  const particleSpeed = ddosMode ? 0.05 : 0.005;

  return (
    <ForceGraph3D
      ref={graphRef}
      graphData={data}
      width={width}
      height={height}
      backgroundColor={bgColor}
      nodeLabel={(n) => `${n.id}${n.cost_per_hour ? ` ($${n.cost_per_hour}/hr)` : ''}`}
      nodeColor={getNodeColor}
      nodeRelSize={6}
      linkColor={() => isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}
      linkOpacity={1}
      linkWidth={1}
      linkDirectionalArrowLength={3.5}
      linkDirectionalArrowRelPos={1}
      linkDirectionalParticles={particleCount}
      linkDirectionalParticleSpeed={particleSpeed}
      linkDirectionalParticleWidth={2}
      linkDirectionalParticleColor={() => ddosMode ? "#ff0000" : (isDark ? "#00e5ff" : "#0055ff")}
      onNodeClick={onNodeClick}
      enableNodeDrag={false}
    />
  );
}
