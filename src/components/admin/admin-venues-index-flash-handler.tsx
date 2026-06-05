'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { ADMIN_VENUES_DELETE_SUCCESS_FLASH } from '@/lib/admin/admin-venues-delete-flash'
import { toastCudSuccess } from '@/lib/client/cud-notify'

export function AdminVenuesIndexFlashHandler() {
  const sp = useSearchParams()
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    if (sp.get('flash') !== ADMIN_VENUES_DELETE_SUCCESS_FLASH) return
    fired.current = true
    toastCudSuccess('delete', 'Venue berhasil dihapus.')
    const next = new URLSearchParams(sp.toString())
    next.delete('flash')
    const qs = next.toString()
    router.replace(qs ? `/admin/venues?${qs}` : '/admin/venues?tab=all')
  }, [sp, router])

  return null
}
