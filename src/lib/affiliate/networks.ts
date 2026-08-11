import { isSafeDestination } from '@/lib/deals/outbound'
import { safeSubId } from '@/lib/affiliate/subid'
import type {
  AffiliateConfig,
  AffiliateLinkBuilder,
  AffiliateNetwork,
  AffiliateOffer,
  LinkContext,
} from '@/lib/affiliate/types'

/**
 * Link builders per netwerk.
 *
 * **Alleen `DIRECT` is volledig werkend.** De vier netwerkconnectors en de
 * Amazon Creators-connector zijn scaffolds: de vorm van de link en de vereiste
 * gegevens staan erin, maar zij zijn niet getest tegen een echt account. Zonder
 * credentials melden zij "niet geconfigureerd" en bouwen zij geen link — er
 * wordt nooit een gokje gedaan met een affiliate-URL.
 *
 * Wat elke connector nog nodig heeft voordat hij echt werkt, staat in
 * `requires` en in de README.
 */
function withSubId(url: string, parameter: string | undefined, subId: string): { url: string; applied: boolean } {
  if (!parameter) return { url, applied: false }
  try {
    const parsed = new URL(url)
    parsed.searchParams.set(parameter, safeSubId(subId))
    return { url: parsed.toString(), applied: true }
  } catch {
    return { url, applied: false }
  }
}

function feedLinkOrNull(offer: AffiliateOffer): string | null {
  if (!offer.affiliateUrl) return null
  return isSafeDestination(offer.affiliateUrl) ? offer.affiliateUrl : null
}

function missingEnv(name: string | undefined): boolean {
  if (!name) return true
  return (process.env[name] ?? '').trim().length === 0
}

/** Zonder netwerk: de gewone winkel-URL, eventueel met een subid-parameter. */
export const directLinkBuilder: AffiliateLinkBuilder = {
  network: 'DIRECT',
  label: 'Direct (zonder netwerk)',
  requires: [],
  isConfigured: () => true,
  missingConfiguration: () => [],
  buildLink(offer, context, config) {
    const feed = feedLinkOrNull(offer)
    const base = feed ?? offer.destinationUrl
    if (!isSafeDestination(base)) {
      return { ok: false, reason: 'bestemming is geen geldige http(s)-URL', notConfigured: false }
    }
    const { url, applied } = withSubId(base, config.subIdParameter, context.subId)
    return { ok: true, url, source: feed ? 'feed' : 'direct', subIdApplied: applied }
  },
}

/**
 * Basis voor de netwerkscaffolds: gebruikt de deeplink uit de feed wanneer die
 * er is, en weigert netjes zolang de configuratie niet compleet is.
 */
function scaffold(options: {
  network: AffiliateNetwork
  label: string
  requires: readonly string[]
  /** Welke velden in de configuratie moeten staan. */
  requiredFields: ReadonlyArray<'publisherId' | 'siteId' | 'mediaId'>
  /** Moet er een environment variable met een sleutel zijn? */
  requiresApiKey: boolean
  defaultSubIdParameter: string
  /** Alleen nodig zolang er geen deeplink uit de feed komt. */
  buildFromScratch?: (offer: AffiliateOffer, context: LinkContext, config: AffiliateConfig) => string | null
}): AffiliateLinkBuilder {
  return {
    network: options.network,
    label: options.label,
    requires: options.requires,
    isConfigured(config) {
      return this.missingConfiguration(config).length === 0
    },
    missingConfiguration(config) {
      const missing: string[] = []
      for (const field of options.requiredFields) {
        if (!config[field] || config[field]!.trim().length === 0) missing.push(`configuration.${field}`)
      }
      if (options.requiresApiKey) {
        if (!config.apiKeyEnv) missing.push('configuration.apiKeyEnv (naam van de environment variable)')
        else if (missingEnv(config.apiKeyEnv)) missing.push(`environment variable ${config.apiKeyEnv}`)
      }
      return missing
    },
    buildLink(offer, context, config) {
      const missing = this.missingConfiguration(config)
      if (missing.length > 0) {
        return {
          ok: false,
          notConfigured: true,
          reason: `${options.label} is niet geconfigureerd: ${missing.join(', ')} ontbreekt`,
        }
      }

      const parameter = config.subIdParameter ?? options.defaultSubIdParameter
      const feed = feedLinkOrNull(offer)
      if (feed) {
        const { url, applied } = withSubId(feed, parameter, context.subId)
        return { ok: true, url, source: 'feed', subIdApplied: applied }
      }

      const built = options.buildFromScratch?.(offer, context, config) ?? null
      if (!built || !isSafeDestination(built)) {
        return {
          ok: false,
          notConfigured: true,
          reason: `${options.label} kan zonder deeplink uit de feed geen link bouwen; dit is een scaffold zonder getest trackingformaat`,
        }
      }
      const { url, applied } = withSubId(built, parameter, context.subId)
      return { ok: true, url, source: 'netwerk', subIdApplied: applied }
    },
  }
}

/** Scaffold. Vereist een echt partneraccount en een getest linkformaat. */
export const bolLinkBuilder = scaffold({
  network: 'BOL',
  label: 'bol partnerprogramma',
  requires: ['site-ID van het partnerprogramma', 'API-sleutel in een environment variable'],
  requiredFields: ['siteId'],
  requiresApiKey: true,
  defaultSubIdParameter: 'subid',
})

export const awinLinkBuilder = scaffold({
  network: 'AWIN',
  label: 'Awin',
  requires: ['publisher-ID (awinaffid)', 'advertiser-ID per merchant', 'API-sleutel voor de feed'],
  requiredFields: ['publisherId'],
  requiresApiKey: true,
  defaultSubIdParameter: 'clickref',
})

export const daisyconLinkBuilder = scaffold({
  network: 'DAISYCON',
  label: 'Daisycon',
  requires: ['media-ID', 'programma-ID per merchant', 'API-credentials'],
  requiredFields: ['mediaId'],
  requiresApiKey: true,
  defaultSubIdParameter: 'si',
})

export const tradetrackerLinkBuilder = scaffold({
  network: 'TRADETRACKER',
  label: 'TradeTracker',
  requires: ['site-ID', 'campagne-ID per merchant', 'API-credentials'],
  requiredFields: ['siteId'],
  requiresApiKey: true,
  defaultSubIdParameter: 'r',
})

/**
 * Amazon Creators API-scaffold. Bewust géén Product Advertising API: die is
 * verouderd voor dit doel. Werkt pas met een goedgekeurd Creators-account.
 */
export const amazonCreatorsLinkBuilder = scaffold({
  network: 'AMAZON_CREATORS',
  label: 'Amazon Creators',
  requires: ['creator- of store-ID', 'Creators API-token in een environment variable'],
  requiredFields: ['publisherId'],
  requiresApiKey: true,
  defaultSubIdParameter: 'ascsubtag',
})

const builders: Record<AffiliateNetwork, AffiliateLinkBuilder> = {
  DIRECT: directLinkBuilder,
  BOL: bolLinkBuilder,
  AWIN: awinLinkBuilder,
  DAISYCON: daisyconLinkBuilder,
  TRADETRACKER: tradetrackerLinkBuilder,
  AMAZON_CREATORS: amazonCreatorsLinkBuilder,
}

export function linkBuilderFor(network: AffiliateNetwork): AffiliateLinkBuilder {
  return builders[network] ?? directLinkBuilder
}

/** Alle netwerken, voor het integratieoverzicht in /admin. */
export function allLinkBuilders(): AffiliateLinkBuilder[] {
  return Object.values(builders)
}

/** Welke netwerken alleen een scaffold zijn; eerlijk in de UI en in de README. */
export const scaffoldOnlyNetworks: readonly AffiliateNetwork[] = [
  'BOL',
  'AWIN',
  'DAISYCON',
  'TRADETRACKER',
  'AMAZON_CREATORS',
]
