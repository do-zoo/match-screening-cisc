import Link from "next/link";
import Image from "next/image";

export function PublicHeader(props: {
  clubNameNav: string;
  logoUrl: string | null;
}) {
  const title = props.clubNameNav;

  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 font-semibold tracking-tight text-[hsl(var(--foreground))]"
        >
          {props.logoUrl ? (
            <Image
              src={props.logoUrl}
              alt={`Logo ${title}`}
              width={32}
              height={32}
              className="shrink-0 rounded-sm object-contain"
              sizes="32px"
            />
          ) : null}
          <span className="truncate">{title}</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-5 text-sm">
          <Link
            href="/"
            className="text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
          >
            Beranda
          </Link>
          <Link
            href="/events"
            className="text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
          >
            Acara
          </Link>
        </nav>
      </div>
    </header>
  );
}
