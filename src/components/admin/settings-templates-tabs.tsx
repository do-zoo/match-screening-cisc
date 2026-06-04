'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { ClubEmailTemplatesPanel } from '@/components/admin/club-email-templates-panel'
import { ClubWaTemplatesPanel } from '@/components/admin/club-wa-templates-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { WaTemplateKey } from '@prisma/client'
import type { EmailTemplateKey } from '@prisma/client'

type Props = {
  waInitial: Partial<Record<WaTemplateKey, string>>
  emailInitial: Partial<Record<EmailTemplateKey, { subject: string; body: string }>>
}

export function SettingsTemplatesTabs({ waInitial, emailInitial }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') === 'email' ? 'email' : 'wa'

  function navigate(nextTab: 'wa' | 'email') {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    router.push(`/admin/settings/templates?${params.toString()}`)
  }

  return (
    <Tabs
      value={tab}
      onValueChange={v => {
        if (v === 'wa' || v === 'email') navigate(v)
      }}
    >
      <TabsList className='w-full'>
        <TabsTrigger value='wa'>WhatsApp</TabsTrigger>
        <TabsTrigger value='email'>Email</TabsTrigger>
      </TabsList>
      <TabsContent value='wa' className='mt-6'>
        <ClubWaTemplatesPanel initialFromDb={waInitial} />
      </TabsContent>
      <TabsContent value='email' className='mt-6'>
        <ClubEmailTemplatesPanel initialFromDb={emailInitial} />
      </TabsContent>
    </Tabs>
  )
}
