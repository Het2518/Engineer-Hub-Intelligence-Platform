"use client";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { useTheme } from "next-themes";

export function CopyButton({ code }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} className="copy-btn" title="Copy code">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span>{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}

export function CodeBlock({ lang, codeString, ...props }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLight = mounted && resolvedTheme === "light";
  const syntaxStyle = isLight ? oneLight : oneDark;

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-lang-badge">{lang || "code"}</span>
        <CopyButton code={codeString} />
      </div>
      <SyntaxHighlighter
        style={syntaxStyle}
        language={lang || "text"}
        PreTag="div"
        CodeTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "0 0 0.5rem 0.5rem",
          fontSize: "0.8125rem",
          lineHeight: "1.65",
          background: "transparent",
          padding: "1rem 1.25rem",
        }}
        {...props}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}
