import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="font-semibold tracking-tight text-[hsl(var(--foreground))]"
        >
          CISC Nobar
        </Link>
        <nav className="flex items-center gap-5 text-sm">
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
