import { twoFactor } from "better-auth/plugins";

import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";
import { sendTransactionalEmail } from "@/lib/auth/send-transactional-email";

export function buildTwoFactorPlugin() {
  return twoFactor(buildTwoFactorPluginOptions());
}

export function buildTwoFactorPluginOptions() {
  const base = {
    backupCodeOptions: {
      amount: 10,
      length: 10,
      storeBackupCodes: "encrypted" as const,
    },
    totpOptions: {
      digits: 6 as const,
      period: 30,
      issuer: "match-screening",
    },
  };

  if (!isTransactionalEmailConfigured()) {
    return base;
  }

  return {
    ...base,
    otpOptions: {
      period: 5,
      digits: 6,
      allowedAttempts: 5,
      storeOTP: "encrypted" as const,
      sendOTP: async ({ user, otp }: { user: { email: string }; otp: string }) => {
        await sendTransactionalEmail({
          to: user.email,
          subject: "Kode verifikasi Match Screening",
          text: `Kode verifikasi Anda: ${otp}\n\nKode berlaku singkat. Jika Anda tidak meminta kode ini, abaikan email ini.`,
        });
      },
    },
  };
}
