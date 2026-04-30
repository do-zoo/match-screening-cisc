"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveRegistration,
  rejectRegistration,
  markPaymentIssue,
} from "@/lib/actions/verify-registration";

type Props = {
  eventId: string;
  registrationId: string;
};

export function RegistrationActions({ eventId, registrationId }: Props) {
  const [isPending, startTransition] = useTransition();

  // Reject panel state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Payment issue panel state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentReason, setPaymentReason] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Approve error state
  const [approveError, setApproveError] = useState<string | null>(null);

  function handleApprove() {
    setApproveError(null);
    startTransition(async () => {
      const result = await approveRegistration(eventId, registrationId);
      if (!result.ok) {
        setApproveError(result.rootError ?? "Terjadi kesalahan.");
      }
    });
  }

  function handleReject() {
    setRejectError(null);
    startTransition(async () => {
      const result = await rejectRegistration(eventId, registrationId, rejectReason);
      if (!result.ok) {
        setRejectError(result.rootError ?? "Terjadi kesalahan.");
      } else {
        setRejectOpen(false);
        setRejectReason("");
      }
    });
  }

  function handlePaymentIssue() {
    setPaymentError(null);
    startTransition(async () => {
      const result = await markPaymentIssue(eventId, registrationId, paymentReason);
      if (!result.ok) {
        setPaymentError(result.rootError ?? "Terjadi kesalahan.");
      } else {
        setPaymentOpen(false);
        setPaymentReason("");
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {/* Approve */}
      <div className="flex flex-col gap-1">
        <Button
          variant="default"
          className="w-full sm:w-auto"
          disabled={isPending}
          onClick={handleApprove}
        >
          Approve
        </Button>
        {approveError && (
          <p className="text-sm text-destructive">{approveError}</p>
        )}
      </div>

      {/* Reject */}
      <div className="flex flex-col gap-2">
        {!rejectOpen ? (
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={() => {
              setRejectOpen(true);
              setPaymentOpen(false);
            }}
          >
            Reject
          </Button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Alasan penolakan</p>
            <Textarea
              placeholder="Tuliskan alasan penolakan..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              disabled={isPending}
            />
            {rejectError && (
              <p className="text-sm text-destructive">{rejectError}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={handleReject}
              >
                Konfirmasi Tolak
              </Button>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setRejectOpen(false);
                  setRejectReason("");
                  setRejectError(null);
                }}
              >
                Batal
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Issue */}
      <div className="flex flex-col gap-2">
        {!paymentOpen ? (
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={() => {
              setPaymentOpen(true);
              setRejectOpen(false);
            }}
          >
            Payment issue
          </Button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Alasan masalah pembayaran</p>
            <Textarea
              placeholder="Tuliskan masalah pembayaran..."
              value={paymentReason}
              onChange={(e) => setPaymentReason(e.target.value)}
              rows={3}
              disabled={isPending}
            />
            {paymentError && (
              <p className="text-sm text-destructive">{paymentError}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="default"
                disabled={isPending}
                onClick={handlePaymentIssue}
              >
                Konfirmasi Masalah Pembayaran
              </Button>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setPaymentOpen(false);
                  setPaymentReason("");
                  setPaymentError(null);
                }}
              >
                Batal
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
