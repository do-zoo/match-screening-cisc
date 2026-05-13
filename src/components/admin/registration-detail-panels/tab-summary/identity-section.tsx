import type { DetailRegistration } from "@/components/admin/registration-detail-panels/shared/registration-detail-types";
import { registrationDetailDateFormatter } from "@/components/admin/registration-detail-panels/shared/format";

type Props = {
  registration: DetailRegistration;
};

export function IdentitySection({ registration }: Props) {
  return (
    <div className="grid gap-2 text-sm">
      <div className="font-medium">{registration.contactName}</div>
      <div className="text-muted-foreground">
        {registration.contactWhatsapp}
        {" · "}
        Nomor member: {registration.claimedMemberNumber ?? "-"}
      </div>
      <div className="text-muted-foreground">
        Dikirim {registrationDetailDateFormatter.format(registration.createdAt)}
      </div>
      <div className="font-mono text-xs text-muted-foreground">{registration.id}</div>
    </div>
  );
}
