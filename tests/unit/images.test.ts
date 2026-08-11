import { describe, expect, it } from 'vitest'
import { deflateSync, gzipSync } from 'node:zlib'
import { readImageDimensions } from '@/lib/images/dimensions'
import { validateImage } from '@/lib/images/validate'
import { imageUpdateForExisting } from '@/jobs/lib/ingest'
import { absoluteImageUrl } from '@/lib/seo/metadata'
import { IMAGE_FALLBACK_SRC } from '@/components/product/ProductImage'

/** Minimale, echte PNG-header met instelbare afmetingen. */
function png(width: number, height: number, padding = 2048): Uint8Array {
  const bytes = new Uint8Array(24 + padding)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function gif(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(2048)
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0)
  const view = new DataView(bytes.buffer)
  view.setUint16(6, width, true)
  view.setUint16(8, height, true)
  return bytes
}

function response(options: {
  status?: number
  contentType?: string
  body?: Uint8Array
  location?: string
}): Response {
  const headers = new Headers()
  if (options.contentType) headers.set('content-type', options.contentType)
  if (options.location) headers.set('location', options.location)
  const status = options.status ?? 200
  // 3xx mag geen body hebben in de Response-constructor.
  const bytes = status >= 300 && status < 400 ? null : (options.body ?? png(800, 800))
  return new Response(bytes as BodyInit | null, { status, headers })
}

const publicHost = async () => ['93.184.216.34']

describe('afmetingen lezen', () => {
  it('leest PNG en GIF', () => {
    expect(readImageDimensions(png(800, 600))).toEqual({ format: 'png', width: 800, height: 600 })
    expect(readImageDimensions(gif(500, 400))).toEqual({ format: 'gif', width: 500, height: 400 })
  })

  it('leest een SVG met viewBox', () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect/></svg>',
    )
    expect(readImageDimensions(svg)).toEqual({ format: 'svg', width: 800, height: 800 })
  })

  it('herkent willekeurige bytes niet als afbeelding', () => {
    const junk = new Uint8Array(2048).fill(0x41)
    expect(readImageDimensions(junk)).toBeNull()
  })
})

describe('afbeeldingvalidatie', () => {
  it('accepteert een geldige externe afbeelding', async () => {
    const result = await validateImage('https://cdn.example/product.png', {
      fetchImpl: async () => response({ contentType: 'image/png', body: png(900, 900) }),
      resolveHost: publicHost,
    })
    expect(result).toMatchObject({ ok: true, contentType: 'image/png', width: 900, height: 900 })
  })

  it('weigert een niet-http-protocol', async () => {
    const result = await validateImage('ftp://cdn.example/product.png', { resolveHost: publicHost })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('protocol')
  })

  it('weigert een 404', async () => {
    const result = await validateImage('https://cdn.example/weg.png', {
      fetchImpl: async () => response({ status: 404, contentType: 'image/png' }),
      resolveHost: publicHost,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('404')
  })

  it('weigert een content-type dat geen afbeelding is', async () => {
    const result = await validateImage('https://cdn.example/product.png', {
      fetchImpl: async () => response({ contentType: 'text/html' }),
      resolveHost: publicHost,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('content-type')
  })

  it('weigert een te kleine afbeelding', async () => {
    const result = await validateImage('https://cdn.example/klein.png', {
      fetchImpl: async () => response({ contentType: 'image/png', body: png(120, 120) }),
      resolveHost: publicHost,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('te klein')
  })

  it('weigert een bestand dat geen afbeelding blijkt', async () => {
    const result = await validateImage('https://cdn.example/nep.png', {
      fetchImpl: async () => response({ contentType: 'image/png', body: new Uint8Array(4096).fill(0x41) }),
      resolveHost: publicHost,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('niet als afbeelding te lezen')
  })

  it('weigert een privé- of lokaal adres (SSRF)', async () => {
    for (const url of ['http://localhost/x.png', 'http://127.0.0.1/x.png', 'http://10.0.0.5/x.png']) {
      const result = await validateImage(url, { resolveHost: publicHost })
      expect(result.ok, url).toBe(false)
    }
    // Een publieke hostnaam die naar een privé-adres wijst, gaat er ook niet in.
    const dnsRebind = await validateImage('https://intern.example/x.png', {
      resolveHost: async () => ['192.168.1.10'],
    })
    expect(dnsRebind.ok).toBe(false)
  })

  it('valideert een redirect opnieuw', async () => {
    const seen: string[] = []
    const result = await validateImage('https://cdn.example/oud.png', {
      fetchImpl: async (input) => {
        const url = String(input)
        seen.push(url)
        if (url.endsWith('oud.png')) {
          return response({ status: 302, location: 'http://10.0.0.9/intern.png' })
        }
        return response({ contentType: 'image/png' })
      },
      resolveHost: publicHost,
    })
    expect(seen).toHaveLength(1)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('privé')
  })

  it('weigert een host die niet in de toegestane image-hosts staat', async () => {
    const result = await validateImage('https://onbekend.example/x.png', {
      allowedHosts: ['cdn.example'],
      fetchImpl: async () => response({ contentType: 'image/png' }),
      resolveHost: publicHost,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('toegestane image-hosts')
  })

  it('probeert het bij een netwerkfout precies één keer opnieuw', async () => {
    let calls = 0
    const result = await validateImage('https://cdn.example/product.png', {
      fetchImpl: async () => {
        calls += 1
        throw new Error('socket hang up')
      },
      resolveHost: publicHost,
    })
    expect(calls).toBe(2)
    expect(result.ok).toBe(false)
  })

  it('valideert een lokale demo-illustratie uit public/', async () => {
    const result = await validateImage('/demo/placeholder.svg')
    expect(result.ok).toBe(true)
    const fallback = await validateImage(IMAGE_FALLBACK_SRC)
    expect(fallback.ok).toBe(true)
  })
})

describe('bestaande geldige afbeelding beschermen', () => {
  it('houdt de werkende afbeelding tot de nieuwe is goedgekeurd', () => {
    const update = imageUpdateForExisting(
      { imageUrl: '/demo/oud.svg', imageStatus: 'VALID', lastValidImageUrl: '/demo/oud.svg' },
      'https://cdn.example/nieuw.jpg',
    )
    expect(update.imageUrl).toBeUndefined()
    expect(update.imageSourceUrl).toBe('https://cdn.example/nieuw.jpg')
    expect(update.imageStatus).toBeUndefined()
  })

  it('vervangt de afbeelding wel wanneer er nog geen geldige is', () => {
    const update = imageUpdateForExisting(
      { imageUrl: '/demo/kapot.svg', imageStatus: 'INVALID', lastValidImageUrl: null },
      'https://cdn.example/nieuw.jpg',
    )
    expect(update.imageUrl).toBe('https://cdn.example/nieuw.jpg')
    expect(update.imageStatus).toBe('PENDING')
  })
})

describe('absolute afbeelding-URL', () => {
  it('laat een externe URL ongewijzigd', () => {
    expect(absoluteImageUrl('https://cdn.merchant.nl/foto.jpg')).toBe('https://cdn.merchant.nl/foto.jpg')
    expect(absoluteImageUrl('http://cdn.merchant.nl/foto.jpg')).toBe('http://cdn.merchant.nl/foto.jpg')
  })

  it('maakt een lokaal pad absoluut zonder dubbele URL', () => {
    const result = absoluteImageUrl('/demo/lamp.svg')
    expect(result.endsWith('/demo/lamp.svg')).toBe(true)
    expect(result.split('http').length - 1).toBe(1)
  })

  it('valt terug op de lokale placeholder zonder afbeelding', () => {
    expect(absoluteImageUrl(null)).toContain('/image-unavailable.svg')
  })
})

describe('gecomprimeerde feeds', () => {
  it('pakt gzip uit', async () => {
    const { fetchFeed } = await import('@/lib/scraping/authenticated-http')
    const original = globalThis.fetch
    const payload = JSON.stringify({ products: [{ sku: '1' }] })
    globalThis.fetch = (async () =>
      new Response(gzipSync(Buffer.from(payload)), {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      })) as typeof fetch
    try {
      const feed = await fetchFeed({ url: 'https://feed.example/products.json.gz' })
      expect(feed.body).toBe(payload)
    } finally {
      globalThis.fetch = original
    }
  })

  it('pakt een eenvoudige zip uit', async () => {
    const { unzipFirstEntry } = await import('@/lib/scraping/authenticated-http')
    const content = Buffer.from('sku;prijs\n1;9,99\n')
    const deflated = deflateSync(content)
    const name = Buffer.from('feed.csv')
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0, 6)
    header.writeUInt16LE(8, 8)
    header.writeUInt32LE(deflated.length, 18)
    header.writeUInt32LE(content.length, 22)
    header.writeUInt16LE(name.length, 26)
    const zip = Buffer.concat([header, name, deflated])
    expect(unzipFirstEntry(new Uint8Array(zip))).toBe(content.toString('utf8'))
  })
})
