import { InvoiceAdjustmentStatus } from "@prisma/client";
import type {
  AttendanceStatus,
  InvoiceAdjustmentType,
  MenuMode,
  MemberValidation,
  RegistrationStatus,
  TicketPriceType,
  TicketRole,
  UploadPurpose,
} from "@prisma/client";

import { RegistrationStatusBadge } from "@/components/admin/registration-status-badge";
import { RegistrationActions } from "@/components/admin/registration-actions";
import { AttendancePanel } from "@/components/admin/attendance-panel";
import { CancelRefundPanel } from "@/components/admin/cancel-refund-panel";
import { MemberValidationPanel } from "@/components/admin/member-validation-panel";
import { InvoiceAdjustmentPanel } from "@/components/admin/invoice-adjustment-panel";
import { VoucherRedemptionPanel } from "@/components/admin/voucher-redemption-panel";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { waMeLink } from "@/lib/wa-templates/encode";
import {
  templateReceipt,
  templateApproved,
  templateRejected,
  templatePaymentIssue,
  templateCancelled,
  templateRefunded,
  templateUnderpaymentInvoice,
} from "@/lib/wa-templates/messages";

export function formatCurrencyIdr(n: number): string {
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
  return formatted.replace(/\s+/g, "");
}

export function formatUploadPurpose(purpose: UploadPurpose): string {
  if (purpose === "transfer_proof") return "Bukti transfer";
  if (purpose === "member_card_photo") return "Foto kartu member";
  return "Bukti penyesuaian invoice";
}

type DetailRegistration = {
  id: string;
  createdAt: Date;
  contactName: string;
  contactWhatsapp: string;
  claimedMemberNumber: string | null;
  computedTotalAtSubmit: number;
  ticketMemberPriceApplied: number;
  ticketNonMemberPriceApplied: number;
  status: RegistrationStatus;
  attendanceStatus: AttendanceStatus;
  memberValidation: MemberValidation;
  rejectionReason: string | null;
  paymentIssueReason: string | null;
  event: {
    title: string;
    venueName: string;
    startAt: Date;
    menuMode: MenuMode;
    menuItems: Array<{ id: string; name: string; price: number; voucherEligible: boolean }>;
    bankAccount: { bankName: string; accountNumber: string; accountName: string } | null;
  };
  tickets: Array<{
    id: string;
    role: TicketRole;
    fullName: string;
    whatsapp: string | null;
    memberNumber: string | null;
    ticketPriceType: TicketPriceType;
    voucherRedeemedMenuItemId: string | null;
    voucherRedeemedAt: Date | null;
    menuSelections: Array<{ menuItem: { name: string; price: number } }>;
  }>;
  uploads: Array<{
    id: string;
    purpose: UploadPurpose;
    blobUrl: string;
    contentType: string;
    bytes: number;
    width: number | null;
    height: number | null;
    originalFilename: string | null;
    createdAt: Date;
  }>;
  adjustments: Array<{
    id: string;
    type: InvoiceAdjustmentType;
    amount: number;
    status: InvoiceAdjustmentStatus;
    paidAt: Date | null;
    createdAt: Date;
    uploads: Array<{ id: string; blobUrl: string; bytes: number; createdAt: Date }>;
  }>;
};

type Props = {
  eventId: string;
  registration: DetailRegistration;
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

function TicketRoleBadge({ role }: { role: TicketRole }) {
  return (
    <Badge variant="secondary" className="capitalize">
      {role}
    </Badge>
  );
}

export function RegistrationDetail({ eventId, registration }: Props) {
  const waPhone = registration.contactWhatsapp;
  const waLinks = [
    {
      label: "WhatsApp · penerimaan pendaftaran",
      href: waMeLink(
        waPhone,
        templateReceipt({
          contactName: registration.contactName,
          eventTitle: registration.event.title,
          registrationId: registration.id,
          computedTotalIdr: registration.computedTotalAtSubmit,
        }),
      ),
      show: true,
    },
    {
      label: "WhatsApp · disetujui",
      href: waMeLink(
        waPhone,
        templateApproved(
          registration.event.title,
          registration.event.venueName,
          registration.event.startAt.toISOString(),
        ),
      ),
      show: registration.status === "approved",
    },
    {
      label: "WhatsApp · ditolak",
      href: registration.rejectionReason
        ? waMeLink(waPhone, templateRejected(registration.rejectionReason))
        : "#",
      show:
        registration.status === "rejected" &&
        Boolean(registration.rejectionReason),
    },
    {
      label: "WhatsApp · masalah pembayaran",
      href: registration.paymentIssueReason
        ? waMeLink(waPhone, templatePaymentIssue(registration.paymentIssueReason))
        : "#",
      show:
        registration.status === "payment_issue" &&
        Boolean(registration.paymentIssueReason),
    },
    {
      label: "WhatsApp · dibatalkan",
      href: waMeLink(waPhone, templateCancelled(registration.contactName, registration.event.title)),
      show: registration.status === "cancelled",
    },
    {
      label: "WhatsApp · refunded",
      href: waMeLink(waPhone, templateRefunded(registration.contactName, registration.event.title)),
      show: registration.status === "refunded",
    },
  ].filter((l) => l.show);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            <span>Registration detail</span>
            <RegistrationStatusBadge status={registration.status} />
          </CardTitle>
          <CardDescription>
            Submitted {dateFormatter.format(registration.createdAt)}
            {` • ${registration.event.title}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-muted-foreground">Contact</div>
              <div className="font-medium">{registration.contactName}</div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-muted-foreground">WhatsApp</div>
              <div className="font-mono">{registration.contactWhatsapp}</div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-muted-foreground">Claimed member</div>
              <div className="font-mono">
                {registration.claimedMemberNumber ?? "-"}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-muted-foreground">Computed total</div>
              <div className="font-mono text-base font-semibold">
                {formatCurrencyIdr(registration.computedTotalAtSubmit)}
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
            {registration.id}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp</CardTitle>
          <CardDescription>
            Klik untuk membuka pesan WhatsApp pre-filled di tab baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {waLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent/60 transition-colors"
              >
                {link.label}
              </a>
            ))}
            {registration.adjustments.filter(a => a.status === InvoiceAdjustmentStatus.unpaid).map(adj => (
              <a
                key={adj.id}
                href={waMeLink(waPhone, templateUnderpaymentInvoice({
                  contactName: registration.contactName,
                  eventTitle: registration.event.title,
                  adjustmentAmountIdr: adj.amount,
                  bankName: registration.event.bankAccount?.bankName ?? "",
                  accountNumber: registration.event.bankAccount?.accountNumber ?? "",
                  accountName: registration.event.bankAccount?.accountName ?? "",
                }))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent/60 transition-colors"
              >
                WhatsApp · tagihan kekurangan ({formatCurrencyIdr(adj.amount)})
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploads</CardTitle>
          <CardDescription>
            Click any thumbnail to open the Blob URL in a new tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registration.uploads.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No uploads are attached to this registration.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {registration.uploads.map((upload) => (
                <a
                  key={upload.id}
                  href={upload.blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group overflow-hidden rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm">
                    <div className="font-medium">{formatUploadPurpose(upload.purpose)}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {Math.round(upload.bytes / 1024)} KB
                    </div>
                  </div>
                  <div className="bg-muted/30 p-3">
                    <img
                      src={upload.blobUrl}
                      alt={upload.originalFilename ?? formatUploadPurpose(upload.purpose)}
                      className="aspect-video w-full rounded-md object-contain ring-1 ring-foreground/10"
                      loading="lazy"
                    />
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
          <CardDescription>
            Tickets and menu selections captured at submission time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Member #</TableHead>
                <TableHead>Menu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registration.tickets.map((ticket) => {
                const menuText =
                  ticket.menuSelections.length === 0
                    ? "-"
                    : ticket.menuSelections
                        .map((s) => s.menuItem.name)
                        .join(", ");

                return (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <TicketRoleBadge role={ticket.role} />
                    </TableCell>
                    <TableCell className="font-medium">{ticket.fullName}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {ticket.whatsapp ?? "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ticket.memberNumber ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {menuText}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <RegistrationActions
            eventId={eventId}
            registrationId={registration.id}
          />
        </CardContent>
      </Card>

      <AttendancePanel
        eventId={eventId}
        registrationId={registration.id}
        current={registration.attendanceStatus}
        registrationStatus={registration.status}
      />

      <MemberValidationPanel
        eventId={eventId}
        registrationId={registration.id}
        current={registration.memberValidation}
        primaryTicket={registration.tickets.find(t => t.role === "primary") ?? null}
        ticketMemberPriceApplied={registration.ticketMemberPriceApplied}
        ticketNonMemberPriceApplied={registration.ticketNonMemberPriceApplied}
      />

      <InvoiceAdjustmentPanel
        eventId={eventId}
        registrationId={registration.id}
        adjustments={registration.adjustments}
      />

      {registration.event.menuMode === "VOUCHER" && (
        <VoucherRedemptionPanel
          eventId={eventId}
          tickets={registration.tickets}
          menuItems={registration.event.menuItems.filter(m => m.voucherEligible)}
        />
      )}

      <CancelRefundPanel
        eventId={eventId}
        registrationId={registration.id}
        status={registration.status}
      />
    </div>
  );
}

