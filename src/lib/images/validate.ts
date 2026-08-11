import { lookup } from 'node:dns/promises'
import { readFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { readImageDimensions, type ImageFormat } from '@/lib/images/dimensions'
import { errorMessage } from '@/lib/logger'

/**
 * Server-side validatie van een productafbeelding. Alleen hier wordt bepaald of
 * een afbeelding echt bestaat, echt een afbeelding is en groot genoeg is. Draait
 * uitsluitend in jobs, nooit tijdens een paginaweergave.
 */
export type ImageValidationOptions = {
  minWidth?: number
  minHeight?: number
  minBytes?: number
  timeoutMs?: number
  /** Hosts waarvan `next/image` mag optimaliseren; leeg betekent: niet controleren. */
  allowedHosts?: readonly string[]
  /** Bewust injecteerbaar zodat tests geen netwerk nodig hebben. */
  fetchImpl?: typeof fetch
  /** Bewust injecteerbaar; standaard een echte DNS-lookup tegen SSRF. */
  resolveHost?: (hostname: string) => Promise<string[]>
}

export type ImageValidationResult =
  | {
      ok: true
      contentType: string
      bytes: number
      format: ImageFormat
      width: number | null
      height: number | null
    }
  | { ok: false; reason: string }

export const DEFAULT_MIN_DIMENSION = 400
const DEFAULT_MIN_BYTES = 1024
const DEFAULT_TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 3
/** Genoeg voor elke header die wij lezen; grote bestanden hoeven niet compleet. */
const MAX_READ_BYTES = 512 * 1024

/** Privé- en loopbackbereiken; een afbeelding hoort van internet te komen. */
function isPrivateAddress(address: string): boolean {
  const value = address.trim().toLowerCase()
  if (value === '::1' || value === '::' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) {
    return true
  }
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) valt terug op de IPv4-controle.
  const mapped = value.startsWith('::ffff:') ? value.slice(7) : value
  const parts = mapped.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [a = 0, b = 0] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

const localHostnames = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', '0.0.0.0'])

async function hostIsPublic(
  hostname: string,
  resolveHost: (host: string) => Promise<string[]>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const lowered = hostname.toLowerCase()
  if (localHostnames.has(lowered) || lowered.endsWith('.localhost') || lowered.endsWith('.internal')) {
    return { ok: false, reason: 'lokale hostnaam is niet toegestaan' }
  }
  if (isPrivateAddress(lowered)) {
    return { ok: false, reason: 'privé-IP-adres is niet toegestaan' }
  }
  try {
    const addresses = await resolveHost(hostname)
    if (addresses.some((address) => isPrivateAddress(address))) {
      return { ok: false, reason: 'hostnaam verwijst naar een privé-IP-adres' }
    }
  } catch (error) {
    return { ok: false, reason: `hostnaam is niet op te zoeken (${errorMessage(error)})` }
  }
  return { ok: true }
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const results = await lookup(hostname, { all: true })
  return results.map((entry) => entry.address)
}

function checkBytes(
  bytes: Uint8Array,
  contentType: string,
  options: Required<Pick<ImageValidationOptions, 'minWidth' | 'minHeight' | 'minBytes'>>,
): ImageValidationResult {
  const dimensions = readImageDimensions(bytes)
  if (!dimensions) {
    return { ok: false, reason: 'bestand is niet als afbeelding te lezen' }
  }
  // Een SVG van 700 bytes kan prima 800x800 zijn; de bytegrens geldt daarom
  // alleen voor rasterformaten.
  const minBytes = dimensions.format === 'svg' ? Math.min(options.minBytes, 128) : options.minBytes
  if (bytes.byteLength < minBytes) {
    return { ok: false, reason: `bestand is te klein (${bytes.byteLength} bytes)` }
  }
  if (dimensions.width !== null && dimensions.height !== null) {
    if (dimensions.width < options.minWidth || dimensions.height < options.minHeight) {
      return {
        ok: false,
        reason: `afbeelding is te klein (${dimensions.width}x${dimensions.height}, minimaal ${options.minWidth}x${options.minHeight})`,
      }
    }
  }
  return {
    ok: true,
    contentType,
    bytes: bytes.byteLength,
    format: dimensions.format,
    width: dimensions.width,
    height: dimensions.height,
  }
}

/**
 * Valideert een lokaal bestand uit `public/`. Demo-illustraties horen bij de
 * applicatie en gaan niet over het netwerk.
 */
async function validateLocalImage(
  path: string,
  options: Required<Pick<ImageValidationOptions, 'minWidth' | 'minHeight' | 'minBytes'>>,
): Promise<ImageValidationResult> {
  const clean = normalize(decodeURIComponent(path.split('?')[0] ?? path))
  if (clean.includes('..')) return { ok: false, reason: 'pad buiten public/ is niet toegestaan' }
  try {
    const buffer = await readFile(join(process.cwd(), 'public', clean))
    const extension = clean.split('.').pop()?.toLowerCase() ?? ''
    const contentType = extension === 'svg' ? 'image/svg+xml' : `image/${extension || 'octet-stream'}`
    return checkBytes(new Uint8Array(buffer), contentType, options)
  } catch (error) {
    return { ok: false, reason: `lokaal bestand niet leesbaar (${errorMessage(error)})` }
  }
}

async function fetchImage(
  url: string,
  options: ImageValidationOptions,
  attempt: number,
): Promise<ImageValidationResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const resolveHost = options.resolveHost ?? defaultResolveHost
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const limits = {
    minWidth: options.minWidth ?? DEFAULT_MIN_DIMENSION,
    minHeight: options.minHeight ?? DEFAULT_MIN_DIMENSION,
    minBytes: options.minBytes ?? DEFAULT_MIN_BYTES,
  }

  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let parsed: URL
    try {
      parsed = new URL(current)
    } catch {
      return { ok: false, reason: 'geen geldige URL' }
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, reason: `protocol ${parsed.protocol} is niet toegestaan` }
    }
    if (options.allowedHosts && options.allowedHosts.length > 0) {
      if (!options.allowedHosts.includes(parsed.hostname)) {
        return {
          ok: false,
          reason: `host ${parsed.hostname} staat niet in de toegestane image-hosts`,
        }
      }
    }
    // Elke hop opnieuw controleren: een redirect mag niet naar intern verkeer.
    const host = await hostIsPublic(parsed.hostname, resolveHost)
    if (!host.ok) return host

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { accept: 'image/*' },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) return { ok: false, reason: `redirect zonder location (${response.status})` }
        current = new URL(location, current).toString()
        continue
      }
      if (response.status !== 200) {
        return { ok: false, reason: `HTTP ${response.status}` }
      }

      const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
      if (!contentType.toLowerCase().startsWith('image/')) {
        return { ok: false, reason: `content-type is ${contentType || 'onbekend'}, geen image/*` }
      }

      const buffer = await response.arrayBuffer()
      return checkBytes(new Uint8Array(buffer.slice(0, MAX_READ_BYTES)), contentType, limits)
    } catch (error) {
      // Maximaal één nieuwe poging; daarna is de afbeelding voor ons ongeldig.
      if (attempt === 0) return fetchImage(url, options, 1)
      return { ok: false, reason: `ophalen mislukt (${errorMessage(error)})` }
    } finally {
      clearTimeout(timer)
    }
  }
  return { ok: false, reason: 'te veel redirects' }
}

/**
 * Valideert één afbeelding. Relatieve paden komen uit `public/`, absolute URL's
 * gaan over http of https met time-out, één retry en SSRF-bescherming.
 */
export async function validateImage(
  url: string,
  options: ImageValidationOptions = {},
): Promise<ImageValidationResult> {
  const trimmed = url.trim()
  if (trimmed.length === 0) return { ok: false, reason: 'geen afbeelding-URL' }

  const limits = {
    minWidth: options.minWidth ?? DEFAULT_MIN_DIMENSION,
    minHeight: options.minHeight ?? DEFAULT_MIN_DIMENSION,
    minBytes: options.minBytes ?? DEFAULT_MIN_BYTES,
  }

  if (trimmed.startsWith('/')) return validateLocalImage(trimmed, limits)
  return fetchImage(trimmed, options, 0)
}
