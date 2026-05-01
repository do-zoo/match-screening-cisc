"use client";

import GlareHover from "@/components/GlareHover";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

type EventCardProps = {
  slug: string;
  title: string;
  summary: string;
  coverBlobUrl: string;
  venueName: string;
  startAtIso: string;
  variant?: "list" | "grid";
};

export function EventCard({
  slug,
  title,
  summary,
  coverBlobUrl,
  venueName,
  startAtIso,
  variant = "list",
}: EventCardProps) {
  const when = new Date(startAtIso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const radius =
    variant === "grid" ? "var(--radius-lg)" : "calc(var(--radius-lg) - 2px)";

  const inner =
    variant === "grid" ? (
      <>
        <div className="relative aspect-16/10 w-full shrink-0 overflow-hidden rounded-t-lg">
          <Image
            src={coverBlobUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw"
          />
        </div>
        <div className="min-w-0 flex-1 p-4">
          <div className="font-medium leading-snug">{title}</div>
          <p className="mt-2 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
            {summary}
          </p>
          <div className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            {venueName} · {when}
          </div>
        </div>
      </>
    ) : (
      <>
        <Image
          src={coverBlobUrl}
          alt=""
          width={96}
          height={96}
          className="size-24 shrink-0 rounded-md object-cover"
          sizes="96px"
        />
        <div className="min-w-0 flex-1 text-left">
          <div className="font-medium leading-snug">{title}</div>
          <p className="mt-1 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
            {summary}
          </p>
          <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {venueName} · {when}
          </div>
        </div>
      </>
    );

  return (
    <GlareHover
      width="100%"
      height="100%"
      background="hsl(var(--card))"
      borderColor="hsl(var(--border))"
      borderRadius={radius}
      glareOpacity={0.22}
      className={cn(
        "flex overflow-hidden shadow-sm transition-shadow hover:shadow-md",
        variant === "grid"
          ? "flex-col items-stretch"
          : "min-h-0 flex-row items-stretch"
      )}
      style={{
        width: "100%",
        minHeight: variant === "list" ? undefined : "100%",
      }}
    >
      <Link
        href={`/events/${slug}`}
        className={cn(
          "relative z-1 flex text-[hsl(var(--foreground))] no-underline outline-none ring-offset-[hsl(var(--background))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
          variant === "grid"
            ? "min-h-0 w-full flex-1 flex-col"
            : "w-full gap-4 p-3"
        )}
      >
        {inner}
      </Link>
    </GlareHover>
  );
}
