import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";

import { buildTwoFactorPlugin } from "@/lib/auth/build-two-factor-plugin-options";
import { prisma } from "../db/prisma";

export const auth = betterAuth({
  appName: "match-screening",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  plugins: [
    nextCookies(),
    buildTwoFactorPlugin(),
    magicLink({
      // For foundations: keep email sending as a no-op.
      // In later plans, replace with Resend and real templates.
      sendMagicLink: async ({ email, url }) => {
        console.log("[magicLink]", { email, url });
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
  },
});

export type AuthSession = typeof auth.$Infer.Session;
