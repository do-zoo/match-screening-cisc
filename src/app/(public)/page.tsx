import { HomeLanding } from "@/components/public/home-landing";
import { getPublicActiveEvents } from "@/lib/events/public-active-events";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beranda",
  description:
    "Temukan acara nobar dan kegiatan CISC yang sedang dibuka pendaftarannya.",
  openGraph: {
    title: "CISC Match Screening",
    description:
      "Temukan acara nobar dan kegiatan CISC yang sedang dibuka pendaftarannya.",
  },
};

export const dynamic = "force-dynamic";

const PREVIEW_LIMIT = 3;

export default async function PublicHomePage() {
  const events = await getPublicActiveEvents();
  const previewEvents = events.slice(0, PREVIEW_LIMIT);

  return <HomeLanding previewEvents={previewEvents} totalCount={events.length} />;
}
