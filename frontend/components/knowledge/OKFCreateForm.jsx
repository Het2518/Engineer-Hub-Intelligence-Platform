"use client";

import { useState } from "react";
import { X, Plus, Shield, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

const OKF_TYPES = [
  { value: "Runbook",        label: "Runbook",        description: "Step-by-step operational procedure" },
  { value: "Playbook",       label: "Playbook",        description: "Incident response guide" },
  { value: "IncidentReport", label: "Incident Report", description: "Post-mortem or incident log" },
  { value: "Architecture",   label: "Architecture",    description: "System design & service map" },
  { value: "Standard",       label: "Standard",        description: "Engineering convention or policy" },
  { value: "Metric",         label: "Metric",          description: "KPI, dashboard, or measurement" },
];

const TEMPLATE_CONTENT = {
  Runbook: `## When to Use
Describe when engineers should use this runbook.

## Prerequisites
- Required access / permissions
- Tools needed

## Steps

1. **Step one**
   \`\`\`bash
   command here
   \`\`\`

2. **Step two**
   Description of what to do.

## Verification
How to verify the procedure succeeded.

## Related
- [Link to related doc](./related.md)`,

  Playbook: `## Trigger
When to invoke this playbook (e.g., P0 alert fires, SLA breach).

## Severity Assessment
How to assess the severity level.

## Response Steps

### 1. Detect & Declare
Action to take first.

### 2. Triage
How to investigate.

### 3. Mitigate
How to resolve.

### 4. Post-Incident
What to do after resolution.

## Escalation Path
On-call → Tech Lead → Engineering Manager`,

  IncidentReport: `## Severity
P0 / P1 / P2

## Duration
Start time — End time

## Impact
Describe user / system impact.

## Timeline

| Time | Event |
|------|-------|
| HH:MM | Description |

## Root Cause
What caused the incident.

## Resolution
How it was resolved.

## Action Items

| Action | Owner | Status |
|--------|-------|--------|
| Fix X  | Team  | ☐ |

## Lessons Learned
Key takeaways.`,

  Architecture: `## Overview
High-level description of this system/component.

## Components

\`\`\`
┌─────────────┐
│  Service A  │
└──────┬──────┘
       │ HTTP
┌──────▼──────┐
│  Service B  │
└─────────────┘
\`\`\`

## Data Flow
Step-by-step data flow description.

## Dependencies
- External service A
- Database B

## Related
- [Related architecture](./other.md)`,

  Standard: `## Rule
The standard, stated concisely.

## Rationale
Why this standard exists.

## Examples

### Good ✅
\`\`\`
example of correct usage
\`\`\`

### Bad ❌
\`\`\`
example of incorrect usage
\`\`\`

## Exceptions
When it's acceptable to deviate.`,

  Metric: `## What it Measures
Description of what this metric tracks.

## Target
- Goal: X
- Warning: Y
- Critical: Z

## How to View
Link or instructions for the dashboard.

## Alerting
When alerts fire and what to do.`,
};

export function OKFCreateForm({ onSuccess, onCancel, initialDoc = null }) {
  const isEdit = !!initialDoc;
  const [form, setForm] = useState({
    okf_type:      initialDoc?.okf_type      || "Runbook",
    title:         initialDoc?.title         || "",
    description:   initialDoc?.description   || "",
    tags:          (initialDoc?.tags || []).join(", "),
    content:       initialDoc?.content       || "",
    resource:      initialDoc?.resource      || "",
    trust_verified:initialDoc?.trust?.verified || false,
    author:        initialDoc?.trust?.author || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleTypeChange = (type) => {
    setForm((f) => ({
      ...f,
      okf_type: type,
      content: f.content || TEMPLATE_CONTENT[type] || "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      okf_type:       form.okf_type,
      title:          form.title.trim(),
      description:    form.description.trim(),
      tags,
      content:        form.content.trim(),
      resource:       form.resource.trim(),
      trust_verified: form.trust_verified,
      author:         form.author.trim(),
    };

    try {
      const url    = isEdit ? `${apiUrl}/knowledge/${initialDoc.source_id}` : `${apiUrl}/knowledge/`;
      const method = isEdit ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to save document");
      }

      setSuccess(true);
      setTimeout(() => onSuccess?.(), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-slide-in-right bg-[hsl(var(--card))] border-l border-[hsl(var(--border))]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[hsl(var(--primary))] to-purple-600 shadow-sm">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-foreground">
              {isEdit ? "Edit Knowledge Document" : "Create Knowledge Document"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              OKF v0.2 compliant
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 rounded-xl transition-all hover:scale-110 bg-[hsl(var(--secondary))] text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Type selector */}
        <div>
          <label className="block text-xs font-semibold mb-2 text-muted-foreground">
            Document Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {OKF_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                className={cn(
                  "text-left px-3 py-2.5 rounded-[var(--radius)] border transition-all duration-200 text-xs",
                  form.okf_type === t.value 
                    ? "bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.4)] text-[hsl(var(--primary))]"
                    : "bg-[hsl(var(--secondary)/0.5)] border-[hsl(var(--border))] text-muted-foreground hover:bg-[hsl(var(--secondary))]"
                )}
              >
                <span className="font-semibold block">{t.label}</span>
                <span className="text-[10px] opacity-70">{t.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Database Rollback Procedure"
            className="v2-input"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">
            Description
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="One-sentence summary of this document"
            className="v2-input"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">
            Tags <span className="font-normal opacity-60">(comma separated)</span>
          </label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="database, rollback, oncall"
            className="v2-input"
          />
        </div>

        {/* Resource URL */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">
            Resource URL <span className="font-normal opacity-60">(optional)</span>
          </label>
          <input
            type="url"
            value={form.resource}
            onChange={(e) => setForm((f) => ({ ...f, resource: e.target.value }))}
            placeholder="https://your-dashboard.internal/..."
            className="v2-input"
          />
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Content (Markdown) <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, content: TEMPLATE_CONTENT[f.okf_type] || "" }))}
              className="text-[10px] px-2 py-1 rounded-lg transition-all bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/0.8)]"
            >
              Use Template
            </button>
          </div>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="Write your content in Markdown..."
            rows={14}
            className="v2-input resize-none font-mono text-xs"
            required
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
        </div>

        {/* Trust section */}
        <div className="rounded-xl p-4 space-y-3 bg-[hsl(var(--secondary)/0.3)] border border-[hsl(var(--border))]">
          <p className="text-xs font-bold flex items-center gap-1.5 text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-green-600 dark:text-green-500" />
            Trust Settings
          </p>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">
              Author / Team
            </label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              placeholder="e.g. platform-team"
              className="v2-input"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              className={cn(
                "w-5 h-5 rounded-[var(--radius)] border flex items-center justify-center transition-all duration-200",
                form.trust_verified 
                  ? "bg-green-600 border-green-600 dark:bg-green-500 dark:border-green-500" 
                  : "bg-transparent border-[hsl(var(--border))] group-hover:border-[hsl(var(--muted-foreground))]"
              )}
              onClick={() => setForm((f) => ({ ...f, trust_verified: !f.trust_verified }))}
            >
              {form.trust_verified && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-xs text-muted-foreground">
              Mark as{" "}
              <span className="font-bold text-green-700 dark:text-green-500">Verified (HIGH TRUST)</span>
              {" "}— enables OKF search boost
            </span>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-500" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in bg-green-500/10 border border-green-500/30">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500" />
            <span className="text-green-700 dark:text-green-400">Document saved to knowledge base!</span>
          </div>
        )}
      </form>

      {/* Footer actions */}
      <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0 border-t border-[hsl(var(--border))]">
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || success}
          className="btn-primary flex-1 justify-center"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : success ? (
            <><CheckCircle2 className="w-4 h-4" /> Saved!</>
          ) : (
            <><Shield className="w-4 h-4" /> {isEdit ? "Update Document" : "Save to Knowledge"}</>
          )}
        </button>
      </div>
    </div>
  );
}
