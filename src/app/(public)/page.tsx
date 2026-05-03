import { HomeLanding } from "@/components/public/home-landing";
import { getPublicActiveEvents } from "@/lib/events/public-active-events";
import {
  SITE_DESCRIPTION_HOME,
  SITE_TITLE_APP,
} from "@/lib/site-metadata";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: SITE_TITLE_APP,
  description: SITE_DESCRIPTION_HOME,
  openGraph: {
    title: SITE_TITLE_APP,
    description: SITE_DESCRIPTION_HOME,
  },
};

export const dynamic = "force-dynamic";

const PREVIEW_LIMIT = 3;

export default async function PublicHomePage() {
  const events = await getPublicActiveEvents();
  const previewEvents = events.slice(0, PREVIEW_LIMIT);

  return (
    <HomeLanding previewEvents={previewEvents} totalCount={events.length} />
  );
}
