import { describe, expect, it } from 'vitest'
import { isSafeDestination, resolveDestination } from '@/lib/deals/outbound'
import { normalizeUrl } from '@/lib/scraping/normalize'

describe('veiligheid van uitgaande links', () => {
  it('staat http en https toe', () => {
    expect(isSafeDestination('https://winkel.example/product/1')).toBe(true)
    expect(isSafeDestination('http://winkel.example/product/1')).toBe(true)
  })

  it('weigert andere schema’s', () => {
    expect(isSafeDestination('javascript:alert(1)')).toBe(false)
    expect(isSafeDestination('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeDestination('file:///etc/passwd')).toBe(false)
    expect(isSafeDestination('ftp://winkel.example/product')).toBe(false)
  })

  it('weigert onvolledige of lege URL’s', () => {
    expect(isSafeDestination('')).toBe(false)
    expect(isSafeDestination('winkel.example/product')).toBe(false)
    expect(isSafeDestination('//winkel.example/product')).toBe(false)
  })
})

describe('affiliate-voorrang', () => {
  it('gebruikt de affiliate-URL zodra die bestaat', () => {
    expect(
      resolveDestination({ affiliateUrl: 'https://partner.example/x', destinationUrl: 'https://winkel.example/x' }),
    ).toBe('https://partner.example/x')
  })

  it('valt terug op de gewone bestemming', () => {
    expect(resolveDestination({ affiliateUrl: null, destinationUrl: 'https://winkel.example/x' })).toBe(
      'https://winkel.example/x',
    )
    expect(resolveDestination({ affiliateUrl: '', destinationUrl: 'https://winkel.example/x' })).toBe(
      'https://winkel.example/x',
    )
  })

  it('negeert de affiliate-URL wanneer affiliate-links uit staan', () => {
    expect(
      resolveDestination(
        { affiliateUrl: 'https://partner.example/x', destinationUrl: 'https://winkel.example/x' },
        { affiliateLinksEnabled: false },
      ),
    ).toBe('https://winkel.example/x')
  })

  it('blijft een onveilige affiliate-URL weigeren', () => {
    // De /go-route combineert beide functies: eerst oplossen, dan controleren.
    const target = resolveDestination({
      affiliateUrl: 'javascript:alert(1)',
      destinationUrl: 'https://winkel.example/x',
    })
    expect(isSafeDestination(target)).toBe(false)
  })
})

describe('URL-normalisatie uit brondata', () => {
  it('maakt relatieve paden absoluut met de basis-URL', () => {
    expect(normalizeUrl('/product/42', 'https://winkel.example/lijst')).toBe('https://winkel.example/product/42')
  })

  it('weigert onveilige schema’s ook uit feeds', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('   ')).toBeNull()
    expect(normalizeUrl(42)).toBeNull()
  })
})
