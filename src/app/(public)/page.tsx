import { EventCard } from "@/components/public/event-card";
import { prisma } from "@/lib/db/prisma";

export default async function PublicHomePage() {
  const events = await prisma.event.findMany({
    where: { status: "active" },
    orderBy: { startAt: "asc" },
    select: {
      slug: true,
      title: true,
      startAt: true,
      venueName: true,
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Nobar — acara aktif
        </h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Pilih acara untuk mendaftar.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {events.map((e) => (
          <li key={e.slug}>
            <EventCard
              slug={e.slug}
              title={e.title}
              venueName={e.venueName}
              startAtIso={e.startAt.toISOString()}
            />
          </li>
        ))}
      </ul>
      {events.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Belum ada acara aktif.
        </p>
      ) : null}
    </main>
  );
}
