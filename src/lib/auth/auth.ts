import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
  appName: "match-screening",
  database: pool,
  plugins: [
    nextCookies(),
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
