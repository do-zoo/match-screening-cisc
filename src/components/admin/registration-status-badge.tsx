import type { RegistrationStatus } from "@prisma/client";

type Props = {
  status: RegistrationStatus;
};

export function RegistrationStatusBadge({ status }: Props) {
  const label = status.replaceAll("_", " ");

  const styles: Record<
    RegistrationStatus,
    { className: string; label?: string }
  > = {
    submitted: {
      label: "submitted",
      className:
        "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
    },
    pending_review: {
      label: "pending review",
      className:
        "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50",
    },
    payment_issue: {
      label: "payment issue",
      className:
        "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50",
    },
    approved: {
      label: "approved",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50",
    },
    rejected: {
      label: "rejected",
      className:
        "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-50",
    },
    cancelled: {
      label: "cancelled",
      className:
        "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
    },
    refunded: {
      label: "refunded",
      className:
        "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
    },
  };

  const s = styles[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium capitalize ${s.className}`}
    >
      {s.label ?? label}
    </span>
  );
}
