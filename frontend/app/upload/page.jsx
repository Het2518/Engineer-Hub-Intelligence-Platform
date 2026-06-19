"use client";

import { FileDropzone } from "../../components/upload/FileDropzone";
import { Upload, Info } from "lucide-react";

export default function UploadPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Upload className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-xl">Upload Documents</h1>
            <p className="text-muted-foreground text-xs mt-0.5 font-medium">
              Index files into your knowledge base
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        {/* Info box */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-accent/5 border border-accent/15 mb-6 shadow-sm">
          <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-accent mb-0.5">How it works</p>
            <p>
              Files are extracted, chunked, and embedded using OpenAI text-embedding-3-small.
              Vectors are stored in ChromaDB. Architecture diagrams are analyzed by GPT-4o Vision.
            </p>
          </div>
        </div>

        {/* Dropzone */}
        <FileDropzone />

        {/* Supported formats */}
        <div className="mt-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Supported Formats
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FORMAT_INFO.map((f) => (
              <div
                key={f.ext}
                className="flex items-start gap-3 px-3 py-2.5 rounded-xl glass hover:border-primary/40 transition-colors shadow-sm"
              >
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0 mt-0.5">
                  {f.ext}
                </span>
                <div>
                  <p className="text-xs font-medium text-foreground">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">{f.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FORMAT_INFO = [
  { ext: "PDF", name: "PDF Documents", note: "Extracted page-by-page with PyMuPDF" },
  { ext: "DOCX", name: "Word Documents", note: "Paragraphs and tables extracted" },
  { ext: "MD", name: "Markdown", note: "Header-aware chunking" },
  { ext: "TXT", name: "Plain Text", note: "Raw text chunking" },
  { ext: "JSON", name: "JSON Files", note: "Pretty-printed and chunked" },
  { ext: "CSV", name: "CSV Files", note: "Row-by-row text extraction" },
  { ext: "PNG/JPG", name: "Architecture Diagrams", note: "GPT-4o Vision analysis" },
];
