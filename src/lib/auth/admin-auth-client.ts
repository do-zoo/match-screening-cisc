"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient, twoFactorClient } from "better-auth/client/plugins";

function redirectToTwoFactorStep(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") ?? "/admin";
  window.location.href = `/admin/sign-in/two-factor?next=${encodeURIComponent(next)}`;
}

export const adminAuthClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: redirectToTwoFactorStep,
    }),
    magicLinkClient(),
  ],
});
