"use client";
import React, { useEffect, useState } from "react";
import mermaid from "mermaid";

import { CodeBlock } from "./CodeBlock";

export function Mermaid({ chart }) {
  const [svg, setSvg] = useState("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      fontFamily: "inherit",
      securityLevel: "loose",
      suppressErrorRendering: true, 
    });
    
    mermaid.parseError = () => {};
    
    const renderChart = async () => {
      const originalError = console.error;
      console.error = () => {}; 
      
      try {
        await mermaid.parse(chart, { suppressErrors: true });
        
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
      } catch (e) {
        setHasError(true);
      }
      
      setTimeout(() => {
        console.error = originalError;
      }, 100);
    };
    renderChart();
  }, [chart]);

  if (hasError) {
    // Seamless fallback to standard code block if AI hallucinates bad mermaid syntax
    return <CodeBlock lang="mermaid" codeString={chart} />;
  }

  if (!svg) {
    return <div className="mermaid-wrapper my-4 flex justify-center bg-[hsl(var(--card))] rounded-[var(--radius)] border border-[hsl(var(--border))] p-4 shadow-sm animate-pulse h-32" />;
  }

  return (
    <div 
      className="mermaid-wrapper my-4 flex justify-center bg-[hsl(var(--card))] rounded-[var(--radius)] border border-[hsl(var(--border))] p-4 shadow-sm overflow-x-auto" 
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
}
