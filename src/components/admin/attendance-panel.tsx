"use client";

import { useState, useTransition } from "react";
import { AttendanceStatus, RegistrationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setAttendance } from "@/lib/actions/attendance";

type Props = {
  eventId: string;
  registrationId: string;
  current: AttendanceStatus;
  registrationStatus: RegistrationStatus;
};

export function AttendancePanel({ eventId, registrationId, current, registrationStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSetAttendance = registrationStatus === RegistrationStatus.approved;

  function handleSet(status: AttendanceStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setAttendance(eventId, registrationId, status);
      if (!result.ok) setError(result.rootError ?? "Terjadi kesalahan.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kehadiran</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="text-sm text-muted-foreground">
          Status saat ini:{" "}
          <span className="font-medium capitalize">{current.replace("_", " ")}</span>
        </div>
        {!canSetAttendance && (
          <p className="text-sm text-muted-foreground">
            Kehadiran hanya dapat dicatat untuk pendaftaran yang sudah disetujui.
          </p>
        )}
        {canSetAttendance && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={isPending || current === AttendanceStatus.attended}
              onClick={() => handleSet(AttendanceStatus.attended)}
            >
              Hadir
            </Button>
            <Button
              variant="outline"
              disabled={isPending || current === AttendanceStatus.no_show}
              onClick={() => handleSet(AttendanceStatus.no_show)}
            >
              Tidak hadir
            </Button>
            <Button
              variant="ghost"
              disabled={isPending || current === AttendanceStatus.unknown}
              onClick={() => handleSet(AttendanceStatus.unknown)}
            >
              Reset
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
