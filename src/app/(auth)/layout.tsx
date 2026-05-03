import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SITE_BRAND_SHORT } from "@/lib/site-metadata";

export const metadata: Metadata = {
  title: `Admin Sign In — ${SITE_BRAND_SHORT}`,
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
