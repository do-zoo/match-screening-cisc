import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";
import { AdminSignInClient } from "@/components/admin/admin-sign-in-client";

export default function AdminSignInPage() {
  const magicLinkEnabled = isTransactionalEmailConfigured();
  return <AdminSignInClient magicLinkEnabled={magicLinkEnabled} />;
}
