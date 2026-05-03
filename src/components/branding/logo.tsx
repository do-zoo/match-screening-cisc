import Image from "next/image";

import { SITE_BRAND_SHORT } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export type LogoProps = {
  className?: string;
  /** Visual height in CSS pixels; width follows intrinsic aspect ratio. */
  height?: number;
  priority?: boolean;
};

/** Club logo from `/public/logo.webp` (served at `/logo.webp`). */
export function Logo({ className, height = 40, priority }: LogoProps) {
  return (
    <Image
      src="/logo.webp"
      alt={SITE_BRAND_SHORT}
      width={480}
      height={160}
      priority={priority}
      className={cn("w-auto object-contain object-left", className)}
      style={{ height, width: "auto", maxWidth: "min(100%, 280px)" }}
    />
  );
}
