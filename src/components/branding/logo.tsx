import Image from "next/image";

import { SITE_BRAND_SHORT } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export type LogoProps = {
  className?: string;
  /**
   * Edge length in CSS pixels (square). The asset is 1:1; width and height
   * are set to this value.
   */
  height?: number;
  priority?: boolean;
};

/** Square club logo from `/public/logo.webp` (served at `/logo.webp`). */
export function Logo({ className, height = 40, priority }: LogoProps) {
  return (
    <Image
      src="/logo.webp"
      alt={SITE_BRAND_SHORT}
      width={512}
      height={512}
      priority={priority}
      className={cn("box-border shrink-0 object-contain object-center", className)}
      style={{ width: height, height, maxWidth: "100%" }}
    />
  );
}
