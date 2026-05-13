import { InvoiceAdjustmentPanel } from "@/components/admin/invoice-adjustment-panel";
import type { DetailRegistration } from "@/components/admin/registration-detail-panels/shared/registration-detail-types";

type Props = {
  eventId: string;
  registration: DetailRegistration;
};

export function InvoiceAdjustmentsSection({ eventId, registration }: Props) {
  return (
    <InvoiceAdjustmentPanel
      eventId={eventId}
      registrationId={registration.id}
      adjustments={registration.adjustments}
    />
  );
}
