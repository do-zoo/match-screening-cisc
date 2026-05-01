"use client";

import FadeContent from "@/components/FadeContent";
import ShinyText from "@/components/ShinyText";
import { EventCard } from "@/components/public/event-card";
import { buttonVariants } from "@/components/ui/button";
import type { PublicActiveEventRow } from "@/lib/events/public-active-events";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

type HomeLandingProps = {
  previewEvents: PublicActiveEventRow[];
  totalCount: number;
};

export function HomeLanding({ previewEvents, totalCount }: HomeLandingProps) {
  const reducedMotion = useReducedMotion();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-6 py-12 md:gap-16 md:py-16">
      <FadeContent blur className="max-w-2xl" threshold={0.15} duration={900}>
        <p className="text-xs font-medium tracking-widest text-[hsl(var(--muted-foreground))] uppercase">
          Komunitas
        </p>
        <h1 className="mt-3 text-balance font-semibold text-3xl tracking-tight text-[hsl(var(--foreground))] md:text-4xl">
          {reducedMotion ? (
            <>Nobar dan kegiatan CISC</>
          ) : (
            <ShinyText
              text="Nobar dan kegiatan CISC"
              className="font-semibold text-3xl tracking-tight md:text-4xl"
              color="hsl(var(--foreground))"
              shineColor="hsl(var(--primary))"
              speed={2.4}
              spread={100}
            />
          )}
        </h1>
        <p className="mt-4 text-pretty text-base leading-relaxed text-[hsl(var(--muted-foreground))] md:text-lg">
          Daftar untuk nobar dan acara resmi klub. Pilih acara pada daftar,
          lengkapi formulir, unggah bukti transfer, lalu tim verifikator akan
          memproses pendaftaran Anda.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/events"
            className={cn(buttonVariants({ variant: "default", size: "lg" }))}
          >
            Lihat semua acara
          </Link>
          <a
            href="#alur-pendaftaran"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "text-[hsl(var(--foreground))]",
            )}
          >
            Alur pendaftaran
          </a>
        </div>
        <ol
          id="alur-pendaftaran"
          className="mt-10 scroll-mt-28 space-y-2 text-sm text-[hsl(var(--muted-foreground))] md:text-base [&>li]:pl-1"
        >
          <li>
            <span className="font-medium text-[hsl(var(--foreground))]">
              Pilih acara
            </span>{" "}
            pada halaman daftar.
          </li>
          <li>
            <span className="font-medium text-[hsl(var(--foreground))]">
              Isi formulir
            </span>{" "}
            dan lampirkan bukti pembayaran.
          </li>
          <li>
            <span className="font-medium text-[hsl(var(--foreground))]">
              Tunggu verifikasi
            </span>{" "}
            dari tim penyelenggara.
          </li>
        </ol>
        <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
          {totalCount === 0
            ? "Saat ini belum ada acara yang dibuka."
            : `${totalCount} acara aktif — buka halaman acara untuk memilih.`}
        </p>
      </FadeContent>

      {previewEvents.length > 0 ? (
        <FadeContent className="flex flex-col gap-5" threshold={0.12} delay={0.15}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-semibold text-xl tracking-tight md:text-2xl">
              Acara mendatang
            </h2>
            {totalCount > previewEvents.length ? (
              <Link
                href="/events"
                className="text-sm font-medium text-[hsl(var(--primary))] underline-offset-4 hover:underline"
              >
                Lihat semua ({totalCount})
              </Link>
            ) : null}
          </div>
          <ul className="flex flex-col gap-3 md:max-w-3xl">
            {previewEvents.map((e) => (
              <li key={e.slug}>
                <EventCard
                  slug={e.slug}
                  title={e.title}
                  summary={e.summary}
                  coverBlobUrl={e.coverBlobUrl}
                  venueName={e.venueName}
                  startAtIso={e.startAtIso}
                  variant="list"
                />
              </li>
            ))}
          </ul>
        </FadeContent>
      ) : null}
    </main>
  );
}
