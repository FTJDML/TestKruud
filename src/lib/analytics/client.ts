import type { AnalyticsEvent } from '@/lib/analytics/events'

/**
 * Client-side event-verzender. Gebruikt `sendBeacon` zodat een klik of een
 * paginawissel niet vertraagt. Er gaat niets naar een externe dienst.
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify(event)
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch('/api/events', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      keepalive: true,
    })
  } catch {
    // Analytics mag nooit een interactie blokkeren.
  }
}
