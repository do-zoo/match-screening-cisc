export function getAdminInitials(displayName: string | null | undefined, email: string | null | undefined): string {
  const name = displayName?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0][0].toUpperCase()
  }
  const emailLocal = email?.split('@')[0]
  if (emailLocal) return emailLocal[0].toUpperCase()
  return 'A'
}
