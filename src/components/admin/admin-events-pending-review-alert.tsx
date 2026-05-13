import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const fmtNum = new Intl.NumberFormat("id-ID");

export function AdminEventsPendingReviewAlert({
  pendingReviewRecapTotal,
}: {
  pendingReviewRecapTotal: number;
}) {
  return (
    <Alert className="border-primary/40 bg-muted/40">
      <AlertTitle>Pendaftar menunggu tinjauan</AlertTitle>
      <AlertDescription>
        {fmtNum.format(pendingReviewRecapTotal)} registrasi dengan status Menunggu tindakan pada
        acara yang Anda lihat dalam tab ini.
      </AlertDescription>
    </Alert>
  );
}
