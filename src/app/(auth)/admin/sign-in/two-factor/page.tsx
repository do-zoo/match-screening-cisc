import { Suspense } from "react";

import { AdminTwoFactorVerifyClient } from "@/components/admin/admin-two-factor-verify-client";
import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";

export default async function AdminTwoFactorVerifyPage() {
  const emailOtpAvailable = isTransactionalEmailConfigured();
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Memuat…</div>}>
      <AdminTwoFactorVerifyClient emailOtpAvailable={emailOtpAvailable} />
    </Suspense>
  );
}
