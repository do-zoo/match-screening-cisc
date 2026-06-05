import { cn } from '@/lib/utils'

export function TemplateEditorLayout(props: {
  main: React.ReactNode
  sidebar: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:gap-8', props.className)}>
      <div className='min-w-0 space-y-5'>{props.main}</div>
      <aside className='flex flex-col gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto xl:overscroll-contain xl:pb-2'>
        {props.sidebar}
      </aside>
    </div>
  )
}
