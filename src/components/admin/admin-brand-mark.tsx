export function AdminBrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-xs font-bold text-primary-foreground shadow-sm"
        aria-hidden
      >
        C
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
          CISC Admin
        </p>
        <p className="text-xs text-sidebar-foreground/70">Panel PIC</p>
      </div>
    </div>
  );
}
