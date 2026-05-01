import { resolveOutboundNotifyBehaviour } from "@/lib/notifications/notification-outbound-mode";
import { loadClubNotificationPreferences } from "@/lib/public/load-club-notification-preferences";

/** Hook contoh kirim keluar — baca prefs; log konsol; cabang provider nyata masih kosong sampai SMTP/Resend. */
export async function logOutboundPerPreferences(
  channel: string,
  payload: Record<string, string | number | boolean | null>,
): Promise<void> {
  const prefs = await loadClubNotificationPreferences();
  const b = resolveOutboundNotifyBehaviour(prefs.outboundMode);
  if (!b.shouldLogToConsole && !b.shouldAttemptProviderSend) return;
  if (b.shouldLogToConsole) {
    console.log("[outbound]", channel, { ...payload, mode: prefs.outboundMode });
  }
  if (b.shouldAttemptProviderSend) {
    /* Wire Resend/SMTP dalam PR berikut ketika env tersedia. */
  }
}
