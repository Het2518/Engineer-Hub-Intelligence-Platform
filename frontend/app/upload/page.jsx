"use client";

import { FileDropzone } from "../../components/upload/FileDropzone";

export default function UploadPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="flex-1 p-8 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
        
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-foreground mb-1 text-center">
          Upload Knowledge
        </h1>
        <p className="text-[0.875rem] text-muted-foreground mb-8 text-center">
          Add documents directly to the Engineer Hub context.
        </p>

        <div className="w-full mb-12">
          <FileDropzone />
        </div>

        <div className="text-center w-full max-w-sm">
          <p className="text-[0.8125rem] font-medium text-muted-foreground/70 mb-4 pb-2 border-b border-[hsl(var(--border))]">
            Processing pipeline
          </p>
          <ul className="text-[0.8125rem] text-muted-foreground space-y-2 text-left w-max mx-auto list-disc list-inside">
            <li>Text extraction</li>
            <li>Semantic chunking</li>
            <li>Vector embedding</li>
            <li>Retrieval indexing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
