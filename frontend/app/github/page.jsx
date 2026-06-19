"use client";

import { useState } from "react";
import { GitFork, Loader2, CheckCircle, AlertCircle, Info, GitBranch } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";

export default function GitHubPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleIndex = async () => {
    if (!repoUrl.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await api.indexGitHub(repoUrl.trim(), branch.trim() || undefined);
      setResult(res);
    } catch (err) {
      setError(err.message || "Indexing failed");
    } finally {
      setIsLoading(false);
    }
  };

  const isValidUrl = repoUrl.trim().startsWith("https://github.com/");

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <GitFork className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-xl">GitHub Repository Indexing</h1>
            <p className="text-muted-foreground text-xs mt-0.5 font-medium">
              Clone and index an entire GitHub repository
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-6">
        {/* Info */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-accent/5 border border-accent/15 shadow-sm">
          <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-accent mb-0.5">What gets indexed</p>
            <p>
              Source code (.py, .ts, .go, .java...), documentation (.md, .txt), configuration
              (.yaml, .json), READMEs, Dockerfiles and Makefiles. Ignores node_modules, build
              artifacts, and binary files.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="glass rounded-2xl border border-border p-6 space-y-4 shadow-sm">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Repository URL *
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border focus-within:border-primary/40 transition-colors shadow-sm">
              <GitFork className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repository"
                className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
              />
            </div>
            {repoUrl && !isValidUrl && (
              <p className="text-xs text-destructive mt-1">Must be a valid GitHub URL (https://github.com/...)</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Branch (optional)
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border focus-within:border-primary/40 transition-colors shadow-sm">
              <GitBranch className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main (default)"
                className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleIndex}
            disabled={isLoading || !isValidUrl}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
              isLoading || !isValidUrl
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary hover:bg-secondary text-primary-foreground shadow-lg shadow-primary/20"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cloning & indexing...
              </>
            ) : (
              <>
                <GitFork className="w-4 h-4" />
                Index Repository
              </>
            )}
          </button>

          {isLoading && (
            <p className="text-[10px] text-center text-muted-foreground">
              This may take a few minutes for large repositories...
            </p>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-green-500/10 border border-green-500/20 animate-fade-in shadow-sm">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-700">Repository indexed successfully</p>
              <p className="text-xs text-green-700/80 mt-1">{result.message}</p>
              <div className="flex gap-4 mt-2">
                <div className="text-xs">
                  <span className="text-green-700/60">Files: </span>
                  <span className="text-green-800 font-medium">{result.files_indexed}</span>
                </div>
                <div className="text-xs">
                  <span className="text-green-700/60">Chunks: </span>
                  <span className="text-green-800 font-medium">{result.chunks_created}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-fade-in shadow-sm">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Indexing failed</p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tips</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-accent flex-shrink-0">•</span>
              Public repos are indexed without authentication
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent flex-shrink-0">•</span>
              For private repos, set <code className="text-accent bg-accent/10 px-1 rounded">GITHUB_TOKEN</code> in the backend environment
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent flex-shrink-0">•</span>
              Large repos may take 2–5 minutes depending on file count
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
