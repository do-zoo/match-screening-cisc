import { AttendancePanel } from "@/components/admin/attendance-panel";
import type { DetailRegistration } from "@/components/admin/registration-detail-panels/shared/registration-detail-types";

type Props = {
  eventId: string;
  registration: DetailRegistration;
};

export function AttendanceSection({ eventId, registration }: Props) {
  return (
    <AttendancePanel
      eventId={eventId}
      registrationId={registration.id}
      current={registration.attendanceStatus}
      registrationStatus={registration.status}
    />
  );
}
