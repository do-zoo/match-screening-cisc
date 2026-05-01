import { CommitteeSettingsPlaceholder } from "@/components/admin/committee-settings-placeholder";

export default function SecuritySettingsPage() {
  return (
    <CommitteeSettingsPlaceholder
      title="Keamanan"
      description="Kebijakan otentikasi (misalnya dorongan 2FA) sesuai kemampuan Better Auth, serta audit akses konfigurasi."
      phaseNote="Rencana implementasi Phase D."
    />
  );
}
