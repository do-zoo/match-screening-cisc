import { EmailTemplateKey } from '@prisma/client'

import { loadClubEmailTemplates } from '@/lib/email-templates/load-club-email-templates'
import { renderLifecycleEmail } from '@/lib/email-templates/render-lifecycle-email'

export async function resolveOtpEmailContent(otp: string): Promise<{
  subject: string
  text: string
  html: string
}> {
  const templates = await loadClubEmailTemplates()
  return renderLifecycleEmail(EmailTemplateKey.otp, templates[EmailTemplateKey.otp] ?? null, {
    otp_code: otp,
  })
}

export async function resolveAdminInviteEmailContent(
  inviteUrl: string,
  roleLabel: string,
): Promise<{ subject: string; text: string; html: string }> {
  const templates = await loadClubEmailTemplates()
  return renderLifecycleEmail(EmailTemplateKey.admin_invite, templates[EmailTemplateKey.admin_invite] ?? null, {
    invite_url: inviteUrl,
    role_label: roleLabel,
  })
}
