"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Upload,
  GitFork,
  BarChart3,
  Brain,
  Zap,
} from "lucide-react";
import { cn } from "../../lib/utils";

const navItems = [
  {
    href: "/chat",
    label: "Chat",
    icon: MessageSquare,
    description: "Ask questions",
  },
  {
    href: "/upload",
    label: "Upload",
    icon: Upload,
    description: "Index documents",
  },
  {
    href: "/github",
    label: "GitHub",
    icon: GitFork,
    description: "Index repositories",
  },
  {
    href: "/admin",
    label: "Dashboard",
    icon: BarChart3,
    description: "System stats",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen flex flex-col border-r border-border bg-card/50 backdrop-blur-sm z-20 shadow-xl shadow-black/5">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-sm leading-tight">
              Engineer Hub
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 font-medium">
              Intelligence Platform
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-3 pt-2 pb-2">
          Navigation
        </p>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group mb-1",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{item.label}</div>
                <div
                  className={cn(
                    "text-[10px] leading-none mt-1",
                    isActive ? "text-primary/70" : "text-muted-foreground/70"
                  )}
                >
                  {item.description}
                </div>
              </div>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-success/10 border border-success/20 shadow-sm">
          <Zap className="w-3.5 h-3.5 text-success flex-shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-success">GPT-4o Powered</p>
            <p className="text-[9px] text-success/70 font-medium">RAG + Hybrid Search</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
