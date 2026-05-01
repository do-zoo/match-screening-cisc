import { HomeLanding } from "@/components/public/home-landing";
import { getPublicActiveEvents } from "@/lib/events/public-active-events";

export const dynamic = "force-dynamic";

const PREVIEW_LIMIT = 3;

export default async function PublicHomePage() {
  const events = await getPublicActiveEvents();
  const previewEvents = events.slice(0, PREVIEW_LIMIT);

  return <HomeLanding previewEvents={previewEvents} totalCount={events.length} />;
}
