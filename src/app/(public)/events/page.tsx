import { EventCard } from "@/components/public/event-card";
import { getPublicActiveEvents } from "@/lib/events/public-active-events";
import { SITE_DESCRIPTION_EVENTS_LIST } from "@/lib/site-metadata";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acara Aktif",
  description: SITE_DESCRIPTION_EVENTS_LIST,
};

export const dynamic = "force-dynamic";

export default async function PublicEventsPage() {
  const events = await getPublicActiveEvents();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight md:text-3xl">
          Acara aktif
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
          Daftar nobar dan kegiatan yang sedang dibuka pendaftarannya. Pilih
          kartu untuk membuka formulir.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Belum ada acara aktif.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.slug}>
              <EventCard
                slug={e.slug}
                title={e.title}
                summary={e.summary}
                coverBlobUrl={e.coverBlobUrl}
                venueName={e.venueName}
                startAtIso={e.startAtIso}
                variant="grid"
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
