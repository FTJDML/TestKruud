import { adsEnabled, appEnv, publicConfig } from '@/lib/env'
import { cn } from '@/lib/utils'
import { AdImpression } from '@/components/ads/AdImpression'

export type AdVariant = 'leaderboard' | 'in-feed' | 'rectangle' | 'mobile-banner'

type Props = {
  /** Unieke naam van de positie, bijvoorbeeld "home-in-feed-1". */
  slot: string
  variant: AdVariant
  className?: string
}

/** Vooraf gereserveerde hoogtes; beperken layout shift als ads aan gaan. */
const reservedHeight: Record<AdVariant, string> = {
  leaderboard: 'min-h-[90px] sm:min-h-[90px]',
  'in-feed': 'min-h-[120px] sm:min-h-[140px]',
  rectangle: 'min-h-[250px]',
  'mobile-banner': 'min-h-[100px] sm:hidden',
}

const variantLabel: Record<AdVariant, string> = {
  leaderboard: 'Leaderboard',
  'in-feed': 'In-feed',
  rectangle: 'Rectangle',
  'mobile-banner': 'Mobile banner',
}

/**
 * Provider-onafhankelijke advertentiepositie. In deze MVP staan advertenties uit.
 *
 * - development: rustige placeholder met het label "Advertentieruimte";
 * - productie met ads uit: het component neemt geen ruimte in;
 * - ads aan: de hoogte wordt vooraf gereserveerd en de provider vult de positie.
 *
 * Advertenties lijken nooit op productkaarten en bedekken nooit de deal-CTA.
 */
export function AdSlot({ slot, variant, className }: Props) {
  const isDevelopment = appEnv() === 'development'

  // ADS_ENABLED is de server-side hoofdschakelaar; NEXT_PUBLIC_ADS_ENABLED
  // bestaat alleen voor clientcomponenten en moet dezelfde waarde hebben.
  if (!adsEnabled()) {
    if (!isDevelopment) return null
    return (
      <aside
        aria-label="Advertentieruimte"
        data-ad-slot={slot}
        className={cn(
          'flex w-full items-center justify-center rounded-tile border border-dashed border-line bg-canvas px-4 py-6 text-center',
          reservedHeight[variant],
          className,
        )}
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Advertentieruimte · {variantLabel[variant]}
          <span className="block text-[11px] font-normal normal-case tracking-normal text-muted/80">
            Alleen zichtbaar in development ({slot})
          </span>
        </span>
      </aside>
    )
  }

  // Ads ingeschakeld: hoogte reserveren en de provider laten vullen.
  const providerReady = publicConfig.adProvider === 'adsense' && publicConfig.adsenseClientId.length > 0

  return (
    <aside
      aria-label="Advertentie"
      data-ad-slot={slot}
      className={cn('w-full rounded-tile border border-line bg-card p-3', reservedHeight[variant], className)}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Advertentie</p>
      {providerReady ? (
        <>
          {/* Ruimte voor de provider; de scriptinjectie hoort bij de provideropzet. */}
          <div
            className="ins-container"
            data-ad-client={publicConfig.adsenseClientId}
            data-ad-slot={slot}
            data-ad-format={variant}
          />
          <AdImpression slot={slot} variant={variant} />
        </>
      ) : (
        <p className="text-xs text-muted">
          Advertenties staan aan, maar er is geen provider geconfigureerd. Stel NEXT_PUBLIC_AD_PROVIDER en de
          bijbehorende client-ID in.
        </p>
      )}
    </aside>
  )
}
