/**
 * Regels voor uitgaande links. Bewust een losse, pure module zodat de
 * /go-route en de tests dezelfde controle gebruiken.
 */

/** Alleen absolute http- en https-bestemmingen zijn toegestaan. */
export function isSafeDestination(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** Affiliate-URL heeft voorrang zodra die bestaat; anders de gewone bestemming. */
export function resolveDestination(offer: {
  affiliateUrl?: string | null
  destinationUrl: string
}): string {
  return offer.affiliateUrl && offer.affiliateUrl.length > 0 ? offer.affiliateUrl : offer.destinationUrl
}
