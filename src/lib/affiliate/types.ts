import { z } from 'zod'
import type { AffiliateNetwork } from '@prisma/client'

/**
 * Affiliatenetwerken. Eén interface, per netwerk één implementatie, zodat een
 * netwerk verwisselen geen wijziging in de frontend of in `/go/[offerId]` vraagt.
 *
 * Belangrijk: een netwerk zonder credentials doet **niets**. Het levert een
 * duidelijke "niet geconfigureerd"-melding en nooit verzonnen data.
 */
export type { AffiliateNetwork }

/**
 * Configuratie per netwerk. Publisher- en site-ID's zijn geen secrets en staan
 * in de merchantconfiguratie; sleutels en tokens staan altijd in de
 * environment en worden hier alleen bij naam genoemd.
 */
export const affiliateConfigSchema = z.object({
  network: z.enum(['DIRECT', 'BOL', 'AWIN', 'DAISYCON', 'TRADETRACKER', 'AMAZON_CREATORS']),
  /** Publisher-, site-, media- of partner-ID van het netwerk. */
  publisherId: z.string().max(64).optional(),
  siteId: z.string().max(64).optional(),
  mediaId: z.string().max(64).optional(),
  /** Naam van de environment variable met de API-sleutel of het token. */
  apiKeyEnv: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/)
    .optional(),
  apiSecretEnv: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/)
    .optional(),
  /** Naam van de queryparameter voor het subid; per netwerk anders. */
  subIdParameter: z.string().max(32).optional(),
})

export type AffiliateConfig = z.infer<typeof affiliateConfigSchema>

export type LinkContext = {
  /** Waar op de site is geklikt, bijvoorbeeld "home_best_deals_3". */
  subId: string
  productId: string
  offerId: string
}

export type AffiliateOffer = {
  destinationUrl: string
  /** Deeplink uit de feed; heeft voorrang wanneer die er is. */
  affiliateUrl: string | null
}

export type LinkResult =
  | { ok: true; url: string; source: 'feed' | 'netwerk' | 'direct'; subIdApplied: boolean }
  | { ok: false; reason: string; notConfigured: boolean }

/**
 * Elk netwerk implementeert deze interface.
 *
 * `isConfigured` moet eerlijk zijn: zonder publisher-ID of zonder de
 * environment variable met de sleutel is het antwoord `false`, en dan bouwt
 * `buildLink` geen link.
 */
export type AffiliateLinkBuilder = {
  readonly network: AffiliateNetwork
  /** Korte naam voor logs en het adminpaneel. */
  readonly label: string
  /** Welke gegevens dit netwerk nodig heeft; voor het integratieoverzicht. */
  readonly requires: readonly string[]
  isConfigured(config: AffiliateConfig): boolean
  /** Ontbrekende onderdelen, met de naam van de env-variabele. Nooit waarden. */
  missingConfiguration(config: AffiliateConfig): string[]
  buildLink(offer: AffiliateOffer, context: LinkContext, config: AffiliateConfig): LinkResult
}
