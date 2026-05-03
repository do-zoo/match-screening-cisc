import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";

import { assertAdminMagicLinkEmail } from "@/lib/auth/assert-admin-magic-link-email";
import { buildTwoFactorPlugin } from "@/lib/auth/build-two-factor-plugin-options";
import { renderMagicLinkEmail } from "@/lib/auth/emails/render-emails";
import { sendTransactionalEmail } from "@/lib/auth/send-transactional-email";
import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";
import { prisma } from "../db/prisma";

export const auth = betterAuth({
  appName: "match-screening",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  plugins: [
    nextCookies(),
    buildTwoFactorPlugin(),
    magicLink({
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        if (!isTransactionalEmailConfigured()) {
          console.log("[magicLink] Email belum dikonfigurasi.", { email, url });
          return;
        }
        await assertAdminMagicLinkEmail(email);
        const html = await renderMagicLinkEmail(url);
        await sendTransactionalEmail({
          to: email,
          subject: "Link masuk Match Screening",
          text: `Klik link berikut untuk masuk ke Match Screening:\n\n${url}\n\nLink berlaku 5 menit.`,
          html,
        });
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
  },
});

export type AuthSession = typeof auth.$Infer.Session;
