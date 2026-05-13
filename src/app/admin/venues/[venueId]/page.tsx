import { redirect } from "next/navigation";

export default async function AdminVenueIndexRedirect({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  redirect(`/admin/venues/${venueId}/edit`);
}
