"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type DropzoneProps = {
  onDrop: (files: File[]) => void;
  children: React.ReactNode;
  /** Nilai atribut `accept` pada input file (mis. `image/jpeg,image/png`). */
  accept?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Zona seret-lepas + klik untuk memilih file. API diselaraskan dengan dokumen rencana
 * (`onDrop` menerima array `File`).
 */
export function Dropzone({
  onDrop,
  children,
  accept = "image/jpeg,image/png,image/webp,image/heic,image/heif",
  disabled,
  className,
}: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const emitFiles = (list: FileList | null) => {
    if (!list?.length) return;
    onDrop(Array.from(list));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={cn(
        "border-input bg-background hover:bg-accent/50 cursor-pointer rounded-lg border border-dashed transition-colors",
        disabled && "pointer-events-none cursor-not-allowed opacity-50",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        emitFiles(e.dataTransfer.files);
      }}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept}
        disabled={disabled}
        onChange={(e) => emitFiles(e.target.files)}
      />
      {children}
    </div>
  );
}
