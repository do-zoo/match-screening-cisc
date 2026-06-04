import { redirect } from 'next/navigation'

export default function LegacyWhatsappTemplatesRedirectPage() {
  redirect('/admin/settings/templates?tab=wa')
}
