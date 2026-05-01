import type { SerializedEventForRegistration } from "@/components/public/event-serialization";

type Props = {
  event: SerializedEventForRegistration;
};

export function EventSummary({ event }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="font-semibold text-lg">{event.title}</div>
      <div className="text-sm text-[hsl(var(--muted-foreground))]">
        {event.venueName} ·{" "}
        {new Date(event.startAtIso).toLocaleString("id-ID", {
          dateStyle: "long",
          timeStyle: "short",
        })}
      </div>
    </div>
  );
}
