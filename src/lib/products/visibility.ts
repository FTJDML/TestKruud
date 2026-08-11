import type { Prisma, ProductStatus } from '@prisma/client'
import { demoContentEnabled } from '@/lib/env'

/**
 * Eén definitie van "publiek zichtbaar". Elke publieke query, de sitemap en de
 * structured data gebruiken deze filter, zodat er geen plek is die het kan
 * vergeten.
 *
 * Publiek is een product alleen wanneer:
 *
 * - de status `PUBLISHED` is — `CANDIDATE`, `DRAFT`, `NEEDS_REVIEW`, `REJECTED`
 *   en `ARCHIVED` geven publiek een echte 404;
 * - de afbeelding is gevalideerd (`imageStatus = VALID`);
 * - er redactionele content is;
 * - het geen demo-inhoud is zolang `DEMO_CONTENT_ENABLED` uit staat.
 */
export function publicProductFilter(extra: Prisma.ProductWhereInput = {}): Prisma.ProductWhereInput {
  return {
    status: 'PUBLISHED',
    imageStatus: 'VALID',
    editorial: { isNot: null },
    ...(demoContentEnabled() ? {} : { isDemo: false }),
    ...extra,
  }
}

/** Statussen die publiek nooit een pagina opleveren. */
export const nonPublicStatuses: readonly ProductStatus[] = [
  'CANDIDATE',
  'DRAFT',
  'NEEDS_REVIEW',
  'REJECTED',
  'ARCHIVED',
]

export type PublicVisibilityInput = {
  status: ProductStatus
  imageStatus: 'PENDING' | 'VALID' | 'INVALID'
  isDemo: boolean
  hasEditorial: boolean
}

export type VisibilityVerdict = { visible: true } | { visible: false; reason: string }

/**
 * Dezelfde regels als {@link publicProductFilter}, maar op één opgehaald
 * product. Geeft de reden terug, zodat het adminpaneel kan uitleggen waarom een
 * product nog niet publiek is.
 */
export function checkPublicVisibility(product: PublicVisibilityInput): VisibilityVerdict {
  if (product.status !== 'PUBLISHED') {
    return { visible: false, reason: `status is ${product.status}, niet PUBLISHED` }
  }
  if (product.imageStatus !== 'VALID') {
    return { visible: false, reason: `afbeelding is ${product.imageStatus}, niet VALID` }
  }
  if (!product.hasEditorial) {
    return { visible: false, reason: 'geen redactionele content' }
  }
  if (product.isDemo && !demoContentEnabled()) {
    return { visible: false, reason: 'demo-inhoud staat uit' }
  }
  return { visible: true }
}
