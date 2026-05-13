import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DetailRegistration } from "@/components/admin/registration-detail-panels/shared/registration-detail-types";
import type { TicketContextVm } from "@/lib/registrations/admin-ticket-context";
import type { ClubWaBodies } from "@/lib/wa-templates/render-wa-from-db";
import { DecisionSection } from "@/components/admin/registration-detail-panels/tab-verification/decision-section";
import { EvidenceSection } from "@/components/admin/registration-detail-panels/tab-verification/evidence-section";
import { CommunicationSection } from "@/components/admin/registration-detail-panels/tab-verification/communication-section";

type Props = {
  eventId: string;
  registration: DetailRegistration;
  ticketContext: TicketContextVm;
  waBodies: ClubWaBodies;
};

export function VerificationTab({
  eventId,
  registration,
  ticketContext,
  waBodies,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verifikasi & Komunikasi</CardTitle>
        <CardDescription>
          Keputusan verifikasi, bukti pendukung, konteks tiket, dan tautan
          WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:p-6">
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold tracking-tight">
            Keputusan verifikasi
          </h3>
          <DecisionSection eventId={eventId} registration={registration} />
        </section>
        <Separator />
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold tracking-tight">
            Bukti pendukung
          </h3>
          <EvidenceSection
            eventId={eventId}
            registration={registration}
            ticketContext={ticketContext}
          />
        </section>
        <Separator />
        <CommunicationSection registration={registration} waBodies={waBodies} />
      </CardContent>
    </Card>
  );
}
