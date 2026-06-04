import { cn } from '@/lib/utils'
import {
  buildGoogleMapsEmbedSrc,
  mapEmbedPreviewCaption,
  resolveMapEmbedSearchQuery,
} from '@/lib/maps/map-embed-preview'

export type MapEmbedPreviewProps = {
  placeName?: string
  placeAddress?: string
  mapUrl?: string | null
  className?: string
  /** `title` pada iframe (aksesibilitas). */
  iframeTitle?: string
  label?: string
  /** Sembunyikan teks penjelasan di bawah iframe. */
  hideCaption?: boolean
}

/**
 * Pratinjau peta Google Maps (embed). Dipakai admin venue dan dapat dipakai halaman publik.
 */
export function MapEmbedPreview({
  placeName,
  placeAddress,
  mapUrl,
  className,
  iframeTitle = 'Peta lokasi di Google Maps',
  label = 'Pratinjau peta',
  hideCaption = false,
}: MapEmbedPreviewProps) {
  const { query, source } = resolveMapEmbedSearchQuery({
    placeName,
    placeAddress,
    mapUrl,
  })
  const src = buildGoogleMapsEmbedSrc(query)
  if (!src) return null

  return (
    <div className={cn('grid gap-2', className)}>
      <p className='text-muted-foreground text-xs font-medium'>{label}</p>
      <div className='border-input relative aspect-video w-full max-w-full overflow-hidden rounded-lg border bg-muted/30'>
        <iframe
          title={iframeTitle}
          className='absolute inset-0 size-full border-0'
          loading='lazy'
          referrerPolicy='no-referrer-when-downgrade'
          src={src}
          allowFullScreen
        />
      </div>
      {!hideCaption ? <p className='text-muted-foreground text-xs'>{mapEmbedPreviewCaption(source)}</p> : null}
    </div>
  )
}
