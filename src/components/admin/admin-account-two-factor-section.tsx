"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import QRCode from "react-qr-code";

import { adminAuthClient } from "@/lib/auth/admin-auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminAccountTwoFactorSection({
  initialTwoFactorEnabled,
}: {
  initialTwoFactorEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [enableOpen, setEnableOpen] = useState(false);
  const [passwordEnable, setPasswordEnable] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [firstTotp, setFirstTotp] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);

  const [disableOpen, setDisableOpen] = useState(false);
  const [passwordDisable, setPasswordDisable] = useState("");

  const [regenOpen, setRegenOpen] = useState(false);
  const [passwordRegen, setPasswordRegen] = useState("");
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

  const refresh = () => router.refresh();

  const handleEnableStart = () => {
    setSetupError(null);
    setPasswordEnable("");
    setTotpURI(null);
    setBackupCodes([]);
    setFirstTotp("");
    setEnableOpen(true);
  };

  const handleEnableSubmit = () => {
    setSetupError(null);
    startTransition(async () => {
      const res = await adminAuthClient.twoFactor.enable({
        password: passwordEnable,
      });
      if (res.error) {
        setSetupError(res.error.message ?? "Gagal mengaktifkan 2FA.");
        return;
      }
      const data = res.data as { totpURI?: string; backupCodes?: string[] } | undefined;
      if (data?.totpURI) setTotpURI(data.totpURI);
      if (data?.backupCodes?.length) setBackupCodes(data.backupCodes);
    });
  };

  const handleVerifyFirstTotp = () => {
    setSetupError(null);
    startTransition(async () => {
      const res = await adminAuthClient.twoFactor.verifyTotp({
        code: firstTotp.replace(/\s/g, ""),
        trustDevice: true,
      });
      if (res.error) {
        setSetupError(res.error.message ?? "Kode tidak valid.");
        return;
      }
      setEnableOpen(false);
      setTotpURI(null);
      setBackupCodes([]);
      setFirstTotp("");
      refresh();
    });
  };

  const handleDisable = () => {
    setSetupError(null);
    startTransition(async () => {
      const res = await adminAuthClient.twoFactor.disable({
        password: passwordDisable,
      });
      if (res.error) {
        setSetupError(res.error.message ?? "Gagal menonaktifkan 2FA.");
        return;
      }
      setDisableOpen(false);
      setPasswordDisable("");
      refresh();
    });
  };

  const handleRegen = () => {
    setSetupError(null);
    startTransition(async () => {
      const res = await adminAuthClient.twoFactor.generateBackupCodes({
        password: passwordRegen,
      });
      if (res.error) {
        setSetupError(res.error.message ?? "Gagal membuat ulang kode.");
        return;
      }
      const data = res.data as { backupCodes?: string[] } | undefined;
      if (data?.backupCodes) setNewBackupCodes(data.backupCodes);
      setPasswordRegen("");
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Autentikasi dua faktor (2FA)</h2>
        <p className="text-sm text-muted-foreground">
          Wajibkan kode dari aplikasi autentikator setelah kata sandi. Simpan kode cadangan di
          tempat aman.
        </p>
      </div>

      {initialTwoFactorEnabled ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">2FA aktif</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPasswordDisable("");
                setSetupError(null);
                setDisableOpen(true);
              }}
            >
              Nonaktifkan
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setPasswordRegen("");
                setNewBackupCodes(null);
                setSetupError(null);
                setRegenOpen(true);
              }}
            >
              Kode cadangan baru
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" onClick={handleEnableStart}>
          Aktifkan 2FA
        </Button>
      )}

      <Dialog open={enableOpen} onOpenChange={setEnableOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aktivasi 2FA</DialogTitle>
            <DialogDescription>
              Masukkan kata sandi akun Anda, lalu pindai QR dengan aplikasi autentikator (Google
              Authenticator, 1Password, dll.).
            </DialogDescription>
          </DialogHeader>

          {setupError ? (
            <p className="text-sm text-destructive" role="alert">
              {setupError}
            </p>
          ) : null}

          {!totpURI ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="twofa-enable-pw">Kata sandi</Label>
                <Input
                  id="twofa-enable-pw"
                  type="password"
                  autoComplete="current-password"
                  value={passwordEnable}
                  onChange={(e) => setPasswordEnable(e.target.value)}
                  disabled={pending}
                />
              </div>
              <DialogFooter>
                <Button type="button" disabled={pending || !passwordEnable} onClick={handleEnableSubmit}>
                  {pending ? "Memproses…" : "Lanjut"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center rounded-md border bg-background p-4">
                <QRCode value={totpURI} size={180} />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Kode cadangan (simpan sekali)</p>
                <ul className="grid grid-cols-2 gap-1 font-mono text-xs">
                  {backupCodes.map((c) => (
                    <li key={c} className="rounded bg-muted px-2 py-1">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twofa-first-code">Kode 6 digit dari aplikasi</Label>
                <Input
                  id="twofa-first-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={firstTotp}
                  onChange={(e) => setFirstTotp(e.target.value)}
                  disabled={pending}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  disabled={pending || firstTotp.replace(/\s/g, "").length < 6}
                  onClick={handleVerifyFirstTotp}
                >
                  {pending ? "Memverifikasi…" : "Selesaikan aktivasi"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nonaktifkan 2FA</DialogTitle>
            <DialogDescription>Konfirmasi dengan kata sandi akun.</DialogDescription>
          </DialogHeader>
          {setupError ? <p className="text-sm text-destructive">{setupError}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="twofa-disable-pw">Kata sandi</Label>
            <Input
              id="twofa-disable-pw"
              type="password"
              value={passwordDisable}
              onChange={(e) => setPasswordDisable(e.target.value)}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="destructive" disabled={pending} onClick={handleDisable}>
              {pending ? "Memproses…" : "Nonaktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={regenOpen}
        onOpenChange={(o) => {
          setRegenOpen(o);
          if (!o) setNewBackupCodes(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kode cadangan baru</DialogTitle>
            <DialogDescription>
              Kode lama tidak berlaku lagi setelah Anda menyimpan yang baru.
            </DialogDescription>
          </DialogHeader>
          {setupError ? <p className="text-sm text-destructive">{setupError}</p> : null}

          {!newBackupCodes ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="twofa-regen-pw">Kata sandi</Label>
                <Input
                  id="twofa-regen-pw"
                  type="password"
                  value={passwordRegen}
                  onChange={(e) => setPasswordRegen(e.target.value)}
                  disabled={pending}
                />
              </div>
              <DialogFooter>
                <Button type="button" disabled={pending || !passwordRegen} onClick={handleRegen}>
                  {pending ? "Memproses…" : "Buat kode baru"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-1 font-mono text-xs">
                {newBackupCodes.map((c) => (
                  <li key={c} className="rounded bg-muted px-2 py-1">
                    {c}
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    setRegenOpen(false);
                    setNewBackupCodes(null);
                  }}
                >
                  Selesai
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
