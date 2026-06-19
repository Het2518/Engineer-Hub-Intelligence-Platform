"use client";

import { useCallback, useState } from "react";
import { Upload, X, File, Image, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api";

const ACCEPTED_TYPES = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/json": ".json",
  "text/csv": ".csv",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

export function FileDropzone() {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((newFiles) => {
    const items = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...items]);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      addFiles(dropped);
    },
    [addFiles]
  );

  const handleFileInput = (e) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const uploadFile = async (item) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, status: "uploading" } : f))
    );
    try {
      const result = await api.uploadFile(item.file);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "success", result } : f
        )
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: "error", error: err.message || "Upload failed" }
            : f
        )
      );
    }
  };

  const uploadAll = async () => {
    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    for (const item of pending) {
      await uploadFile(item);
    }
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const pendingCount = files.filter((f) => f.status === "pending" || f.status === "error").length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 shadow-sm bg-card",
          isDragging
            ? "border-primary/60 bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/30 hover:bg-primary/5"
        )}
      >
        <input
          type="file"
          multiple
          accept={Object.keys(ACCEPTED_TYPES).join(",")}
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200",
            isDragging
              ? "bg-primary/20 border border-primary/30"
              : "bg-muted border border-border"
          )}>
            <Upload className={cn("w-6 h-6", isDragging ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-foreground font-medium">
              {isDragging ? "Drop files here" : "Drag & drop files"}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              or <span className="text-primary font-medium">click to browse</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 mt-1">
            {["PDF", "DOCX", "TXT", "MD", "JSON", "CSV", "PNG", "JPG"].map((ext) => (
              <span
                key={ext}
                className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border font-medium"
              >
                {ext}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{files.length} file(s)</p>
            {pendingCount > 0 && (
              <button
                onClick={uploadAll}
                className="px-4 py-1.5 rounded-xl bg-primary hover:bg-secondary text-primary-foreground text-sm font-medium transition-colors shadow-sm"
              >
                Upload {pendingCount} file{pendingCount !== 1 ? "s" : ""}
              </button>
            )}
          </div>

          {files.map((item) => (
            <FileRow key={item.id} item={item} onRemove={removeFile} onUpload={uploadFile} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileRow({
  item,
  onRemove,
  onUpload,
}) {
  const ext = item.file.name.split(".").pop()?.toUpperCase() || "FILE";
  const isImage = ["PNG", "JPG", "JPEG"].includes(ext);
  const Icon = isImage ? Image : FileText;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl glass border border-border animate-fade-in shadow-sm">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground font-semibold truncate">{item.file.name}</p>
        <p className="text-[10px] text-muted-foreground/80 font-medium">
          {(item.file.size / 1024).toFixed(1)} KB
          {item.result && ` · ${item.result.chunks_created} chunks indexed`}
          {item.error && ` · ${item.error}`}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {item.status === "pending" && (
          <button
            onClick={() => onUpload(item)}
            className="text-xs font-medium px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            Upload
          </button>
        )}
        {item.status === "uploading" && (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}
        {item.status === "success" && (
          <CheckCircle className="w-4 h-4 text-success" />
        )}
        {item.status === "error" && (
          <AlertCircle className="w-4 h-4 text-destructive" />
        )}
        <button
          onClick={() => onRemove(item.id)}
          className="w-6 h-6 rounded-lg hover:bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
