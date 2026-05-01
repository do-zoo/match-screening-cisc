"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { adminAuthClient } from "@/lib/auth/admin-auth-client";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AdminTwoFactorVerifyClient({
  emailOtpAvailable,
}: {
  emailOtpAvailable: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") ?? "/admin", [searchParams]);

  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingOtpSend, startOtpSend] = useTransition();

  const goNext = () => {
    router.push(next);
    router.refresh();
  };

  const onVerifyTotp = () => {
    setError(null);
    startTransition(async () => {
      const res = await adminAuthClient.twoFactor.verifyTotp({
        code: totpCode.replace(/\s/g, ""),
        trustDevice: true,
      });
      if (res.error) {
        setError(res.error.message ?? "Kode tidak valid.");
        return;
      }
      goNext();
    });
  };

  const onVerifyBackup = () => {
    setError(null);
    startTransition(async () => {
      const res = await adminAuthClient.twoFactor.verifyBackupCode({
        code: backupCode.replace(/\s/g, ""),
        trustDevice: true,
      });
      if (res.error) {
        setError(res.error.message ?? "Kode cadangan tidak valid.");
        return;
      }
      goNext();
    });
  };

  const onSendOtp = () => {
    setError(null);
    startOtpSend(async () => {
      const res = await adminAuthClient.twoFactor.sendOtp();
      if (res.error) {
        setError("Terjadi kesalahan. Coba lagi atau gunakan kode aplikasi autentikator.");
        return;
      }
    });
  };

  const onVerifyOtp = () => {
    setError(null);
    startTransition(async () => {
      const res = await adminAuthClient.twoFactor.verifyOtp({
        code: otpCode.replace(/\s/g, ""),
        trustDevice: true,
      });
      if (res.error) {
        setError(res.error.message ?? "Kode tidak valid.");
        return;
      }
      goNext();
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Verifikasi kedua</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Masukkan kode dari aplikasi autentikator atau kode cadangan Anda.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mt-8 space-y-4">
        <Field>
          <FieldLabel htmlFor="ms-2fa-totp">Kode 6 digit (TOTP)</FieldLabel>
          <Input
            id="ms-2fa-totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            placeholder="000000"
            disabled={pending}
          />
        </Field>
        <Button type="button" className="w-full" disabled={pending} onClick={onVerifyTotp}>
          {pending ? "Memverifikasi…" : "Verifikasi TOTP"}
        </Button>
      </section>

      <section className="mt-10 space-y-4 border-t pt-8">
        <h2 className="text-sm font-medium">Kode cadangan</h2>
        <Field>
          <FieldLabel htmlFor="ms-2fa-backup">Satu kode cadangan</FieldLabel>
          <Input
            id="ms-2fa-backup"
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value)}
            disabled={pending}
            autoComplete="off"
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={onVerifyBackup}
        >
          {pending ? "Memverifikasi…" : "Gunakan kode cadangan"}
        </Button>
      </section>

      {emailOtpAvailable ? (
        <section className="mt-10 space-y-4 border-t pt-8">
          <h2 className="text-sm font-medium">Kode email</h2>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={pendingOtpSend || pending}
            onClick={onSendOtp}
          >
            {pendingOtpSend ? "Mengirim…" : "Kirim kode ke email"}
          </Button>
          <Field>
            <FieldLabel htmlFor="ms-2fa-otp-email">Kode dari email</FieldLabel>
            <Input
              id="ms-2fa-otp-email"
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              disabled={pending}
            />
          </Field>
          <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={onVerifyOtp}>
            {pending ? "Memverifikasi…" : "Verifikasi kode email"}
          </Button>
        </section>
      ) : (
        <p className="mt-8 text-xs text-muted-foreground">
          Verifikasi lewat kode email belum diaktifkan pada lingkungan ini. Gunakan TOTP atau kode
          cadangan.
        </p>
      )}
    </main>
  );
}
