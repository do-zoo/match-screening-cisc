"use client";

import { Image as ImageIcon } from "lucide-react";
import * as React from "react";

import { Dropzone } from "@/components/ui/dropzone";

type Props = {
  /** URL gambar yang sudah tersimpan (mode edit, sebelum pengguna memilih file baru). */
  value?: string;
  onChange: (file: File) => void;
  maxSize?: number;
  disabled?: boolean;
};

const DEFAULT_MAX = 5 * 1024 * 1024;

/**
 * Pratinjau + zona unggah sampul sesuai dokumen rencana formulir admin acara.
 */
export function ImageUploadDropzone({
  value,
  onChange,
  maxSize = DEFAULT_MAX,
  disabled,
}: Props) {
  const [preview, setPreview] = React.useState<string | undefined>(value);
  const [error, setError] = React.useState<string | null>(null);
  const userPickedRef = React.useRef(false);

  React.useEffect(() => {
    if (userPickedRef.current) return;
    setPreview(value);
  }, [value]);

  const handleDrop = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    if (file.size > maxSize) {
      setError("File terlalu besar. Maksimal 5 MB.");
      return;
    }
    userPickedRef.current = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    onChange(file);
  };

  return (
    <div className="space-y-4">
      {preview ? (
        <div className="border-input relative h-64 w-full overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau data URL / URL blob publik */}
          <img
            src={preview}
            alt="Pratinjau sampul"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Dropzone onDrop={handleDrop} disabled={disabled}>
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <ImageIcon className="text-muted-foreground mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            Seret & lepas foto sampul, atau klik untuk memilih file
          </p>
        </div>
      </Dropzone>
    </div>
  );
}
