import { twoFactor } from 'better-auth/plugins'

import { resolveOtpEmailContent } from '@/lib/email-templates/render-auth-template-email'
import { sendTransactionalEmail } from '@/lib/auth/send-transactional-email'
import { isTransactionalEmailConfigured } from '@/lib/auth/transactional-email-config'

export function buildTwoFactorPlugin() {
  return twoFactor(buildTwoFactorPluginOptions())
}

export function buildTwoFactorPluginOptions() {
  const base = {
    backupCodeOptions: {
      amount: 10,
      length: 10,
      storeBackupCodes: 'encrypted' as const,
    },
    totpOptions: {
      digits: 6 as const,
      period: 30,
      issuer: 'match-screening',
    },
  }

  if (!isTransactionalEmailConfigured()) {
    return base
  }

  return {
    ...base,
    otpOptions: {
      period: 5,
      digits: 6,
      allowedAttempts: 5,
      storeOTP: 'encrypted' as const,
      sendOTP: async ({ user, otp }: { user: { email: string }; otp: string }) => {
        const { subject, text, html } = await resolveOtpEmailContent(otp)
        await sendTransactionalEmail({
          to: user.email,
          subject,
          text,
          html,
        })
      },
    },
  }
}
