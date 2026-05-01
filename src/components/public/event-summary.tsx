import Image from "next/image";
import parse from "html-react-parser";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import { cn } from "@/lib/utils";

type Props = {
  event: SerializedEventForRegistration;
};

export function EventSummary({ event }: Props) {
  const start = new Date(event.startAtIso).toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const end = new Date(event.endAtIso).toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-4">
      <Image
        src={event.coverBlobUrl}
        alt=""
        width={1200}
        height={630}
        className="aspect-video w-full rounded-lg border border-border object-cover"
        sizes="(max-width: 768px) 100vw, 672px"
        priority
      />
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-lg tracking-tight">{event.title}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{event.summary}</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {event.venueName} · {start} — {end}
        </p>
      </div>
      <div
        className={cn(
          "event-description max-w-none space-y-3 text-sm leading-relaxed text-[hsl(var(--foreground))]",
          "[&_p]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic",
          "[&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold",
        )}
      >
        {parse(event.descriptionHtml)}
      </div>
    </div>
  );
}
