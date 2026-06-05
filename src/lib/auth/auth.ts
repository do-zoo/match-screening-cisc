import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { magicLink } from 'better-auth/plugins/magic-link'

import { assertAdminMagicLinkEmail } from '@/lib/auth/assert-admin-magic-link-email'
import { buildTwoFactorPlugin } from '@/lib/auth/build-two-factor-plugin-options'
import { resolveMagicLinkEmailContent } from '@/lib/email-templates/render-magic-link-email'
import { sendTransactionalEmail } from '@/lib/auth/send-transactional-email'
import { isTransactionalEmailConfigured } from '@/lib/auth/transactional-email-config'
import { prisma } from '../db/prisma'

export const auth = betterAuth({
  appName: 'match-screening',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  plugins: [
    nextCookies(),
    buildTwoFactorPlugin(),
    magicLink({
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        if (!isTransactionalEmailConfigured()) {
          console.log('[magicLink] Email belum dikonfigurasi.', { email, url })
          return
        }
        await assertAdminMagicLinkEmail(email)
        const { subject, text, html } = await resolveMagicLinkEmailContent(url)
        await sendTransactionalEmail({
          to: email,
          subject,
          text,
          html,
        })
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
  },
})

export type AuthSession = typeof auth.$Infer.Session
