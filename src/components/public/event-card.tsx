import Link from "next/link";

type EventCardProps = {
  slug: string;
  title: string;
  venueName: string;
  startAtIso: string;
};

export function EventCard({ slug, title, venueName, startAtIso }: EventCardProps) {
  const when = new Date(startAtIso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Link
      className="block rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:bg-[hsl(var(--accent))]/40"
      href={`/e/${slug}`}
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        {venueName} · {when}
      </div>
    </Link>
  );
}
