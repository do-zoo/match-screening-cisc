"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { DownloadIcon, UploadIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { importMasterMembersCsv } from "@/lib/actions/admin-master-members";

type Props = {
  csvTemplateText: string;
  onImported: () => void;
};

type ImportSummary = {
  successCount: number;
  failureCount: number;
  errorCsvBase64: string | null;
};

export function MemberCsvImportPanel({ csvTemplateText, onImported }: Props) {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSummary(null);
    setError(null);

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Pilih berkas CSV terlebih dahulu.");
      return;
    }

    const fd = new FormData();
    fd.set("file", file);

    startTransition(async () => {
      const result = await importMasterMembersCsv(undefined, fd);
      if (!result.ok) {
        setError(
          result.rootError ??
            Object.values(result.fieldErrors ?? {}).join(", ") ??
            "CSV gagal diimpor.",
        );
        return;
      }

      setSummary(result.data);
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    });
  }

  function downloadTemplate() {
    downloadTextFile(csvTemplateText, "template-master-anggota.csv");
  }

  function downloadErrors() {
    if (!summary?.errorCsvBase64) return;
    downloadTextFile(
      decodeBase64Utf8(summary.errorCsvBase64),
      "master-anggota-errors.csv",
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import CSV</CardTitle>
        <CardDescription>
          Unggah CSV untuk membuat atau memperbarui master anggota.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <DownloadIcon data-icon="inline-start" />
            Unduh template
          </Button>
        </div>

        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
          <Input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            disabled={isPending}
            className="sm:max-w-md"
          />
          <Button type="submit" disabled={isPending}>
            <UploadIcon data-icon="inline-start" />
            {isPending ? "Mengimpor..." : "Import CSV"}
          </Button>
        </form>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Import gagal</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {summary ? (
          <Alert>
            <AlertTitle>Import selesai</AlertTitle>
            <AlertDescription>
              {summary.successCount} baris berhasil, {summary.failureCount}{" "}
              baris gagal.
            </AlertDescription>
            {summary.errorCsvBase64 ? (
              <div data-slot="alert-action">
                <Button type="button" size="sm" onClick={downloadErrors}>
                  Unduh error
                </Button>
              </div>
            ) : null}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function downloadTextFile(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function decodeBase64Utf8(value: string) {
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
