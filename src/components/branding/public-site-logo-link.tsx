import Link from "next/link";

import { Logo, type LogoProps } from "@/components/branding/logo";
import { cn } from "@/lib/utils";

type PublicSiteLogoLinkProps = {
  href?: string;
  /** Passed through to {@link Logo}. */
  height?: LogoProps["height"];
  priority?: boolean;
  className?: string;
};

/** Logo linking home (or another path) for public layouts. */
export function PublicSiteLogoLink({
  href = "/",
  height = 48,
  priority,
  className,
}: PublicSiteLogoLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 rounded-md outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Logo height={height} priority={priority} />
    </Link>
  );
}
