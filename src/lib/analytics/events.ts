import { z } from 'zod'
import { logger } from '@/lib/logger'

/**
 * Interne eventlaag. In deze MVP gaat er niets naar een externe dienst; een
 * toekomstige provider kan achter dezelfde interface worden aangesloten.
 */
export const analyticsEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('product_impression'),
    productId: z.string().min(1),
    surface: z.string().min(1).max(60),
    position: z.number().int().min(0).max(500).optional(),
  }),
  z.object({ type: z.literal('product_detail_view'), productId: z.string().min(1) }),
  z.object({
    type: z.literal('outbound_click'),
    productId: z.string().min(1),
    offerId: z.string().min(1),
    source: z.string().min(1).max(60),
  }),
  z.object({ type: z.literal('save'), productId: z.string().min(1) }),
  z.object({ type: z.literal('unsave'), productId: z.string().min(1) }),
  z.object({ type: z.literal('search'), query: z.string().min(1).max(120) }),
  z.object({ type: z.literal('category_click'), categorySlug: z.string().min(1).max(80) }),
  z.object({
    type: z.literal('scroll_depth'),
    path: z.string().min(1).max(200),
    percentage: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
  }),
  z.object({
    type: z.literal('ad_impression'),
    slot: z.string().min(1).max(60),
    variant: z.string().min(1).max(40),
  }),
])

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>

export type AnalyticsProvider = {
  readonly name: string
  track(event: AnalyticsEvent, context: { visitorId?: string | null }): void | Promise<void>
}

/** Standaardprovider: schrijft naar de log, verstuurt niets naar buiten. */
export const logAnalyticsProvider: AnalyticsProvider = {
  name: 'log',
  track(event) {
    logger.debug('analytics', { ...event })
  },
}

const providers: AnalyticsProvider[] = [logAnalyticsProvider]

export function registerAnalyticsProvider(provider: AnalyticsProvider): void {
  if (!providers.some((entry) => entry.name === provider.name)) providers.push(provider)
}

export async function trackServerEvent(
  event: AnalyticsEvent,
  context: { visitorId?: string | null } = {},
): Promise<void> {
  await Promise.all(providers.map((provider) => provider.track(event, context)))
}
