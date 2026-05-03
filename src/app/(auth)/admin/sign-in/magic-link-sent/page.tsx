import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function resolveFirst(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Partially hide local part when echoing email from query (optional UX). */
function maskEmailForDisplay(email: string): string {
  const [local, domain] = email.trim().split("@");
  if (!domain || local === undefined) return email;
  if (local.length <= 1) return `*@${domain}`;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}•••@${domain}`;
}

/** Maps Better Auth magic-link verify errors (redirect query `error`). */
function magicLinkVerifyErrorMessage(code: string): string {
  switch (code) {
    case "INVALID_TOKEN":
      return "Link masuk tidak valid atau tidak dikenali. Minta tautan baru dari halaman masuk, dan pastikan membuka link dari email tanpa mengubahnya.";
    case "EXPIRED_TOKEN":
      return "Tautan sudah kedaluwarsa. Minta magic link baru dari halaman masuk.";
    case "ATTEMPTS_EXCEEDED":
      return "Tautan ini sudah digunakan. Minta magic link baru jika Anda perlu masuk lagi.";
    case "new_user_signup_disabled":
      return "Akun untuk email ini tidak ditemukan sebagai pengguna yang sudah terdaftar.";
    case "failed_to_create_session":
      return "Gagal membuat sesi. Coba lagi atau masuk dengan email dan kata sandi.";
    default:
      return "Tautan magic link gagal diverifikasi. Minta tautan baru dari halaman masuk.";
  }
}

export default async function MagicLinkSentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const errorCode = resolveFirst(sp.error);
  const emailRaw = resolveFirst(sp.email);

  if (errorCode) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Tautan tidak bisa dipakai</h1>
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Verifikasi gagal</AlertTitle>
          <AlertDescription>{magicLinkVerifyErrorMessage(errorCode)}</AlertDescription>
        </Alert>
        <p className="mt-6 text-sm text-muted-foreground">
          <Link
            href="/admin/sign-in"
            className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/90"
          >
            Kembali ke halaman masuk
          </Link>{" "}
          dan kirim ulang magic link.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Cek email Anda</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {emailRaw ? (
          <>
            Kami sudah mengirim link masuk ke{" "}
            <span className="font-medium text-foreground tabular-nums">
              {maskEmailForDisplay(safeDecodeURIComponent(emailRaw))}
            </span>
            . Link berlaku selama 5 menit.
          </>
        ) : (
          <>Kami sudah mengirim link masuk ke email Anda. Link berlaku selama 5 menit.</>
        )}
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Tidak menerima email? Periksa folder spam atau{" "}
        <Link href="/admin/sign-in" className="underline underline-offset-4 hover:text-foreground">
          kembali dan coba lagi
        </Link>
        .
      </p>
    </main>
  );
}
