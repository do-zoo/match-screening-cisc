import type { RegistrationStatus } from "@prisma/client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { RegistrationStatusBadge } from "@/components/admin/registration-status-badge";
import {
  formatCurrencyIdr,
  registrationDetailDateFormatter,
} from "@/components/admin/registration-detail-panels/shared/format";

type Props = {
  contactName: string;
  contactWhatsapp: string;
  computedTotalAtSubmit: number;
  createdAt: Date;
  status: RegistrationStatus;
  rejectionReason: string | null;
  paymentIssueReason: string | null;
};

export function RegistrationDetailHeader({
  contactName,
  contactWhatsapp,
  computedTotalAtSubmit,
  createdAt,
  status,
  rejectionReason,
  paymentIssueReason,
}: Props) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{contactName}</h1>
        <RegistrationStatusBadge status={status} />
      </div>
      <p className="text-sm text-muted-foreground">
        {contactWhatsapp}
      </p>
      <p className="text-sm text-muted-foreground">
        {formatCurrencyIdr(computedTotalAtSubmit)}
        {" · "}
        Dikirim {registrationDetailDateFormatter.format(createdAt)}
      </p>
      {rejectionReason ? (
        <Alert variant="destructive" role="status">
          <AlertTitle>Alasan penolakan</AlertTitle>
          <AlertDescription>{rejectionReason}</AlertDescription>
        </Alert>
      ) : null}
      {paymentIssueReason ? (
        <Alert
          role="status"
          className="border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100"
        >
          <AlertTitle>Masalah pembayaran</AlertTitle>
          <AlertDescription>{paymentIssueReason}</AlertDescription>
        </Alert>
      ) : null}
    </header>
  );
}
