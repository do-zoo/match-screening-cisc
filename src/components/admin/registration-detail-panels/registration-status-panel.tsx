"use client";

import { RegistrationActions } from "@/components/admin/registration-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  eventId: string;
  registrationId: string;
};

/** Panel status verifikasi (approve / tolak / masalah bayar) per baris registrasi. */
export function RegistrationStatusPanel({ eventId, registrationId }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status verifikasi</CardTitle>
        <CardDescription>
          Tindakan untuk status pendaftaran baris ini saja.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegistrationActions
          eventId={eventId}
          registrationId={registrationId}
        />
      </CardContent>
    </Card>
  );
}
