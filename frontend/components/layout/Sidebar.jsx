"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useTheme } from "next-themes";
import {
  Upload,
  BarChart3,
  BookOpen,
  Plus,
  Loader2,
  Trash2,
  Sun,
  Moon,
  Search,
  Database,
  GitBranch,
  Zap,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { getAuthHeaders } from "../../lib/constants";

const navGroups = [
  {
    label: "SYSTEM",
    items: [
      { href: "/map", label: "Neuro-Map", icon: Zap },
      { href: "/sources", label: "Sources", icon: Database },
      { href: "/admin", label: "Settings", icon: BarChart3 },
    ],
  },
  {
    label: "KNOWLEDGE",
    items: [
      { href: "/knowledge", label: "Documents", icon: BookOpen },
      { href: "/upload", label: "Upload", icon: Upload },
      { href: "/github", label: "GitHub", icon: GitBranch },
    ],
  },
];

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentSessionId = searchParams.get("id");

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [backendError, setBackendError] = useState(false);

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchSessions = async (attempt = 0) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/chat/sessions`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSessions(data || []);
        setBackendError(false);
      }
    } catch (e) {
      if (attempt < 3) {
        // Retry up to 3 times with 2s delay — backend may still be starting up
        setTimeout(() => fetchSessions(attempt + 1), 2000);
        return;
      }
      setBackendError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [currentSessionId, pathname]);

  const handleDeleteSession = async (e, sessionId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    setDeletingId(sessionId);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      await fetch(`${apiUrl}/chat/sessions/${sessionId}`, { method: "DELETE", headers: getAuthHeaders() });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        router.push("/chat");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <aside className="w-[280px] h-screen flex flex-col z-20 flex-shrink-0 bg-background border-r border-border transition-colors duration-200">
      {/* ── Logo ────────────────────────────────────────────── */}
      <div className="px-5 py-6">
        <h1 className="font-semibold text-[1rem] text-foreground tracking-tight flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-bold">A</div>
          Axioms
        </h1>
        <p className="text-[0.7rem] text-muted-foreground font-medium uppercase tracking-wider mt-1">
          Engineering Intelligence
        </p>
      </div>

      {/* ── New Chat Button ──────────────────────────────────── */}
      <div className="px-4 pb-4">
        <Link
          href="/chat"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[0.875rem] font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Link>
      </div>

      {/* ── Search Placeholder ───────────────────────────────── */}
      <div className="px-4 pb-2">
        <div className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[0.8125rem] text-muted-foreground bg-muted border border-border shadow-sm">
          <Search className="w-4 h-4 opacity-50" />
          <span className="opacity-70">Search sessions...</span>
          <span className="ml-auto text-[0.65rem] border border-border px-1.5 rounded text-muted-foreground/70 font-mono">⌘K</span>
        </div>
      </div>

      {/* ── Recent Chats ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 scrollbar-none py-2">
        <div className="px-2 pb-1 pt-2">
          <p className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
            CHAT
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : backendError ? (
          <div className="px-2 mt-2">
            <p className="text-[0.75rem] text-destructive font-medium">
              Backend Offline
            </p>
            <button
              onClick={() => { setLoading(true); setBackendError(false); fetchSessions(); }}
              className="text-[0.75rem] mt-1 text-muted-foreground underline hover:text-foreground"
            >
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-[0.8125rem] px-2 text-muted-foreground/60 mt-1">
            No recent sessions
          </p>
        ) : (
          <div className="space-y-0.5 mt-1">
            {sessions.map((s) => {
              const isActive = currentSessionId === s.id || (pathname === '/chat' && currentSessionId === s.id);
              return (
                <Link
                  key={s.id}
                  href={`/chat?id=${s.id}`}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.875rem] transition-colors group truncate border border-transparent",
                    isActive 
                      ? "bg-secondary text-secondary-foreground font-medium" 
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <span className="truncate flex-1 pr-2">{s.title || "New Session"}</span>
                  
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className={cn(
                      "opacity-0 flex-shrink-0 p-1 rounded-sm transition-opacity hover:bg-background hover:text-destructive",
                      isActive ? "group-hover:opacity-100" : "group-hover:opacity-100"
                    )}
                    title="Delete session"
                  >
                    {deletingId === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground transition-colors" />
                    )}
                  </button>
                </Link>
              );
            })}
          </div>
        )}

        {navGroups.map((group) => (
          <div key={group.label} className="mt-6">
            <div className="px-2 pb-1">
              <p className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </p>
            </div>
            <div className="space-y-0.5 mt-1">
              {group.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors group text-[0.875rem]",
                      isActive 
                        ? "bg-secondary text-secondary-foreground font-medium" 
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer / Theme ────────────────────────── */}
      <div className="p-4 border-t border-border mt-auto">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors text-[0.875rem] text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 opacity-70" /> : <Moon className="w-4 h-4 opacity-70" />}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>
        )}
      </div>
    </aside>
  );
}

export function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside className="w-64 h-screen flex-shrink-0 bg-background border-r border-[hsl(var(--border))]" />
      }
    >
      <SidebarContent />
    </Suspense>
  );
}
