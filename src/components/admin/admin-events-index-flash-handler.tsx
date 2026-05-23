'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { ADMIN_EVENTS_DELETE_SUCCESS_FLASH } from '@/lib/admin/admin-events-delete-flash'
import { toastCudSuccess } from '@/lib/client/cud-notify'

export function AdminEventsIndexFlashHandler() {
  const sp = useSearchParams()
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    if (sp.get('flash') !== ADMIN_EVENTS_DELETE_SUCCESS_FLASH) return
    fired.current = true
    toastCudSuccess('delete', 'Acara berhasil dihapus.')
    const next = new URLSearchParams(sp.toString())
    next.delete('flash')
    const qs = next.toString()
    router.replace(qs ? `/admin/events?${qs}` : '/admin/events?tab=active')
  }, [sp, router])

  return null
}
