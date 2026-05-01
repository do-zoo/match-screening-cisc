"use client";

import { ImagePlus } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
  type Ref,
} from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type FileFieldProps = {
  ref?: Ref<HTMLInputElement | null>;
  id: string;
  label: ReactNode;
  description?: ReactNode;
  name: string;
  onBlur?: () => void;
  /** Selected file (`undefined` if cleared or none). Typical RHF wiring: field.onChange */
  onChange?: (file: File | undefined) => void;
  invalid?: boolean;
  /** Same shape as `FieldError`; pass e.g. `fieldState.error ? [fieldState.error] : undefined` from RHF. */
  errors?: Array<{ message?: string } | undefined>;
  /** Defaults to `image/*` */
  accept?: string;
  pickPrompt?: string;
  replacePrompt?: string;
  emptySubtitle?: string;
  disabled?: boolean;
  required?: boolean;
};

export function FileField({
  ref,
  id,
  label,
  description,
  name,
  onBlur,
  onChange,
  invalid = false,
  errors,
  accept = "image/*",
  pickPrompt = "Ketuk untuk memilih foto",
  replacePrompt = "Ganti foto",
  emptySubtitle = "Belum ada file dipilih",
  disabled,
  required,
}: FileFieldProps) {
  const hintId = useId();
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const previewUrl = useMemo(() => {
    if (!selectedFile?.type.startsWith("image/")) return null;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const hasDescription = Boolean(description);

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description ? (
        <FieldDescription id={hintId}>{description}</FieldDescription>
      ) : null}
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-input bg-muted/25 px-4 py-3 text-left transition-colors",
          "hover:border-muted-foreground/40 hover:bg-muted/40",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          disabled && "pointer-events-none opacity-50",
          invalid &&
            "border-destructive/60 bg-destructive/5 focus-within:border-destructive focus-within:ring-destructive/25 dark:focus-within:ring-destructive/35",
        )}
      >
        <input
          ref={ref}
          id={id}
          type="file"
          name={name}
          accept={accept}
          className="sr-only"
          aria-invalid={invalid}
          aria-describedby={hasDescription ? hintId : undefined}
          disabled={disabled}
          required={required}
          onBlur={onBlur}
          onChange={(e) => {
            const f = e.target.files?.[0];
            onChange?.(f);
            setSelectedFile(f ?? null);
            setFileLabel(f?.name ?? null);
          }}
        />
        <ImagePlus
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {fileLabel ? replacePrompt : pickPrompt}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {fileLabel ?? emptySubtitle}
          </p>
        </div>
      </label>
      {previewUrl ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-muted/20">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview; not a remote LCP candidate */}
          <img
            src={previewUrl}
            alt={
              fileLabel ? `Pratinjau berkas yang dipilih: ${fileLabel}` : ""
            }
            className="mx-auto block max-h-[400px] w-full object-contain"
          />
        </div>
      ) : null}
      {invalid && errors?.length ? (
        <FieldError errors={errors} />
      ) : null}
    </Field>
  );
}
