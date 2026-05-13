import Image from "next/image";
import parse from "html-react-parser";
import { MapPin } from "lucide-react";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import { formatIdr } from "@/lib/utils/format-idr";
import { cn } from "@/lib/utils";

type Props = {
  event: SerializedEventForRegistration;
};

export function EventSummary({ event }: Props) {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleString("id-ID", opts);

  const dateTimeLong: Intl.DateTimeFormatOptions = {
    dateStyle: "long",
    timeStyle: "short",
  };

  const mapHref = event.venueMapUrl
    ? event.venueMapUrl
    : `https://maps.google.com/?q=${encodeURIComponent(event.venueAddress)}`;

  return (
    <div className="flex flex-col gap-4">
      <Image
        src={event.coverBlobUrl}
        alt=""
        width={1200}
        height={630}
        className="aspect-1200/630 w-full rounded-lg border border-border object-cover"
        sizes="(max-width: 768px) 100vw, 672px"
        priority
      />

      <div className="flex flex-col gap-3">
        <div>
          <h1 className="font-semibold text-lg tracking-tight">{event.title}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {event.summary}
          </p>
        </div>

        {/* Structured info table */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-[hsl(var(--muted-foreground))]">Venue</dt>
          <dd>{event.venueName}</dd>

          <dt className="text-[hsl(var(--muted-foreground))]">Alamat</dt>
          <dd className="flex items-center gap-1.5">
            <span>{event.venueAddress}</span>
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              aria-label="Buka lokasi di peta"
            >
              <MapPin className="size-3.5" />
            </a>
          </dd>

          <dt className="text-[hsl(var(--muted-foreground))]">Registrasi</dt>
          <dd>
            {fmt(event.openRegistrationAtIso, dateTimeLong)} —{" "}
            {fmt(event.closeRegistrationAtIso, dateTimeLong)}
          </dd>

          <dt className="text-[hsl(var(--muted-foreground))]">Gate dibuka</dt>
          <dd>{fmt(event.openGateAtIso, dateTimeLong)}</dd>

          <dt className="text-[hsl(var(--muted-foreground))]">Mulai</dt>
          <dd>{fmt(event.kickOffAtIso, dateTimeLong)}</dd>

          <dt className="text-[hsl(var(--muted-foreground))]">Harga tiket</dt>
          <dd>
            {formatIdr(event.ticketMemberPrice)}{" "}
            <span className="text-[hsl(var(--muted-foreground))]">(member)</span>
            {" / "}
            {formatIdr(event.ticketNonMemberPrice)}{" "}
            <span className="text-[hsl(var(--muted-foreground))]">(umum)</span>
          </dd>
        </dl>
      </div>
      <div
        className={cn(
          "event-description max-w-none space-y-3 text-sm leading-relaxed text-[hsl(var(--foreground))]",
          "[&_p]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic",
          "[&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold",
          "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md",
          "[&_hr]:my-6 [&_hr]:border-border",
        )}
      >
        {parse(event.descriptionHtml)}
      </div>
    </div>
  );
}
