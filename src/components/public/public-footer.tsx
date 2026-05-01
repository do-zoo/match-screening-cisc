export function PublicFooter(props: {
  footerPlainText: string | null;
}) {
  if (!props.footerPlainText?.trim()) return null;

  return (
    <footer className="mt-auto border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
      <div className="mx-auto max-w-5xl px-6">{props.footerPlainText}</div>
    </footer>
  );
}
