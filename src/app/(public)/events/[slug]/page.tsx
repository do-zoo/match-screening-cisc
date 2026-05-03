import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { EventSummary } from "@/components/public/event-summary";
import {
  getActiveEventRegistrationPageData,
  getSerializedEventForPublicRegistration,
} from "@/lib/events/event-registration-page";
import { cn } from "@/lib/utils";
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
    title: event.title,
    description: event.summary,
    openGraph: {
      title: `${event.title} — CISC`,
      description: event.summary,
      images: event.coverBlobUrl ? [{ url: event.coverBlobUrl }] : [],
      type: "website",
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getSerializedEventForPublicRegistration(slug);

  if (!event) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <nav>
          <Link
            href="/events"
            className="text-sm text-[hsl(var(--muted-foreground))] underline-offset-4 hover:text-[hsl(var(--foreground))] hover:underline"
          >
            ← Daftar acara
          </Link>
        </nav>
        <EventSummary event={event} />

        <div className="flex flex-col gap-3 border-t border-[hsl(var(--border))] pt-6">
          {event.registrationOpen ? (
            <Link
              href={`/events/${event.slug}/register`}
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "w-full sm:w-auto"
              )}
            >
              Daftar untuk acara ini
            </Link>
          ) : (
            <Alert>
              <AlertTitle>Pendaftaran ditutup</AlertTitle>
              <AlertDescription>
                {event.registrationClosedMessage ??
                  "Pendaftaran untuk acara ini saat ini tidak tersedia."}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </main>
  );
}
