/** Pesan pengunjung bila pengurus menutup pendaftaran seluruh situs tanpa pesan kustom. */
export const DEFAULT_GLOBAL_REGISTRATION_CLOSED =
  "Sementara waktu pendaftaran acara ditutup sementara oleh pengurus. Silakan coba lagi nanti.";

/**
 * Menggabungkan apakah registrasi untuk satu acara terbuka di UX publik;
 * penutupan global mengalahkan status per-acara.
 */
export function mergeGlobalRegistrationClosure(args: {
  registrationOpen: boolean;
  registrationClosedMessage: string | null;
  registrationGloballyDisabled: boolean;
  globalRegistrationClosedMessage: string | null;
}): {
  registrationOpen: boolean;
  registrationClosedMessage: string | null;
} {
  if (!args.registrationGloballyDisabled) {
    return {
      registrationOpen: args.registrationOpen,
      registrationClosedMessage: args.registrationClosedMessage,
    };
  }
  const trimmed = args.globalRegistrationClosedMessage?.trim() ?? "";
  const msg = trimmed !== "" ? trimmed : DEFAULT_GLOBAL_REGISTRATION_CLOSED;
  return { registrationOpen: false, registrationClosedMessage: msg };
}

/** Banner publik: null = tidak menampilkan alert; teks dipakai apa adanya. */
export function effectiveMaintenanceBanner(
  plain: string | null | undefined,
): string | null {
  if (plain == null) return null;
  const t = plain.trim();
  return t === "" ? null : t;
}
