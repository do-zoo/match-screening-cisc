import { RegistrationFormClientOnly } from "@/components/public/registration-form-client-only";
import {
  getActiveEventRegistrationPageData,
  getSerializedEventForPublicRegistration,
} from "@/lib/events/event-registration-page";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getActiveEventRegistrationPageData(slug);
  if (!event) {
    return { title: "Acara tidak ditemukan" };
  }
  return {
    title: `Pendaftaran — ${event.title}`,
    description: event.summary,
  };
}

export default async function EventRegistrationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getSerializedEventForPublicRegistration(slug);

  if (!event) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <nav>
          <Link
            href={`/events/${event.slug}`}
            className="text-sm text-[hsl(var(--muted-foreground))] underline-offset-4 hover:text-[hsl(var(--foreground))] hover:underline"
          >
            ← Kembali ke detail acara
          </Link>
        </nav>
        <header className="flex flex-col gap-1">
          <h1 className="font-semibold text-xl tracking-tight md:text-2xl">
            Pendaftaran: {event.title}
          </h1>
          <p className="text-sm leading-relaxed text-foreground/80">
            Beberapa langkah singkat — ringkasan harga akan muncul sebelum pembayaran.
            Siapkan bukti transfer untuk langkah terakhir.
          </p>
        </header>
        <RegistrationFormClientOnly event={event} />
      </div>
    </main>
  );
}
