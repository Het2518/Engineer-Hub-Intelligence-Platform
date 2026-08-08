"use client";

export function ThinkingIndicator({ okfSources = 0, ragSources = 0, total = 0 }) {
  return (
    <div className="flex items-center gap-3 py-1 px-1 animate-fade-in">
      {/* Three-dot shimmer */}
      <div className="flex items-center gap-1">
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
            style={{
              animation: `pulse 1.4s ease-in-out infinite`,
              animationDelay: `${delay}ms`,
            }}
          />
        ))}
      </div>

      <span className="text-[0.8125rem] text-muted-foreground/60 font-medium">
        {total > 0
          ? `Searching ${total} source${total !== 1 ? "s" : ""}…`
          : "Thinking…"}
      </span>
    </div>
  );
}
