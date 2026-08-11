import { gunzipSync, inflateSync } from 'node:zlib'
import { fetchBinary, fetchText, type FetchTextOptions } from '@/lib/scraping/http'
import type { FeedAuth } from '@/merchants/schemas/feed-config'
import { logger } from '@/lib/logger'

/**
 * Geauthenticeerde feeddownload. Deze module doet één ding: een verzoek
 * opbouwen met de juiste headers en het antwoord uitpakken. Zij kent geen
 * veldmapping en geen affiliatelogica.
 *
 * Secrets komen altijd uit de environment. De merchantconfiguratie bevat alleen
 * de naam van de variabele, dus een configuratie in de database of in een
 * back-up bevat nooit een sleutel.
 */
export type AuthResolution =
  | { ok: true; headers: Record<string, string>; credentialsPresent: boolean }
  | { ok: false; missing: string[] }

function readEnv(name: string): string {
  return (process.env[name] ?? '').trim()
}

/** Zet een `auth`-configuratie om in headers; meldt welke variabelen ontbreken. */
export function resolveAuthHeaders(auth: FeedAuth = { type: 'none' }): AuthResolution {
  if (auth.type === 'none') return { ok: true, headers: {}, credentialsPresent: false }

  if (auth.type === 'basic') {
    const username = readEnv(auth.usernameEnv)
    const password = readEnv(auth.passwordEnv)
    const missing = [
      username.length === 0 ? auth.usernameEnv : null,
      password.length === 0 ? auth.passwordEnv : null,
    ].filter((name): name is string => name !== null)
    if (missing.length > 0) return { ok: false, missing }
    const encoded = Buffer.from(`${username}:${password}`).toString('base64')
    return { ok: true, headers: { authorization: `Basic ${encoded}` }, credentialsPresent: true }
  }

  if (auth.type === 'bearer') {
    const token = readEnv(auth.tokenEnv)
    if (token.length === 0) return { ok: false, missing: [auth.tokenEnv] }
    return { ok: true, headers: { authorization: `Bearer ${token}` }, credentialsPresent: true }
  }

  const value = readEnv(auth.valueEnv)
  if (value.length === 0) return { ok: false, missing: [auth.valueEnv] }
  return { ok: true, headers: { [auth.headerName.toLowerCase()]: value }, credentialsPresent: true }
}

/** Zijn de credentials aanwezig? Voor het integratieoverzicht, zonder waarden. */
export function credentialsAvailable(auth: FeedAuth = { type: 'none' }): boolean {
  const resolved = resolveAuthHeaders(auth)
  return resolved.ok && (auth.type === 'none' || resolved.credentialsPresent)
}

export type Compression = 'none' | 'gzip' | 'zip' | 'auto'

function looksGzipped(bytes: Uint8Array): boolean {
  return bytes[0] === 0x1f && bytes[1] === 0x8b
}

function looksZipped(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)
}

/**
 * Pakt één bestand uit een ZIP zonder dependency. Bewust beperkt tot het
 * eenvoudige en veilige geval: het eerste item, opgeslagen (methode 0) of
 * deflate (methode 8), zonder mappen en zonder encryptie. Alles daarbuiten is
 * een duidelijke fout in plaats van een aanname.
 */
export function unzipFirstEntry(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (!looksZipped(bytes)) throw new Error('geen ZIP-bestand')

  const flags = view.getUint16(6, true)
  if ((flags & 0x1) !== 0) throw new Error('versleutelde ZIP wordt niet ondersteund')
  const method = view.getUint16(8, true)
  const compressedSize = view.getUint32(18, true)
  const nameLength = view.getUint16(26, true)
  const extraLength = view.getUint16(28, true)
  const start = 30 + nameLength + extraLength

  if (compressedSize === 0 && (flags & 0x8) !== 0) {
    throw new Error('ZIP met streaming-groottes wordt niet ondersteund')
  }
  const payload = bytes.subarray(start, start + compressedSize)
  if (method === 0) return new TextDecoder().decode(payload)
  if (method === 8) return inflateSync(payload, { finishFlush: 2 }).toString('utf8')
  throw new Error(`ZIP-compressiemethode ${method} wordt niet ondersteund`)
}

export type FeedRequest = {
  url: string
  auth?: FeedAuth
  headers?: Record<string, string>
  compression?: Compression
  accept?: string
} & Pick<FetchTextOptions, 'timeoutMs' | 'retries'>

export type FeedResponse = { body: string; url: string }

/**
 * Haalt een feed op met authenticatie en pakt gzip of zip uit. Gebruikt dezelfde
 * HTTP-laag als de rest van de scraping: time-outs, retries met backoff, rate
 * limiting per host en een herkenbare user-agent.
 */
export async function fetchFeed(request: FeedRequest): Promise<FeedResponse> {
  const auth = resolveAuthHeaders(request.auth)
  if (!auth.ok) {
    throw new Error(
      `authenticatie niet geconfigureerd: environment variable(s) ${auth.missing.join(', ')} ontbreken`,
    )
  }

  const compression = request.compression ?? 'auto'
  const options = {
    headers: {
      accept: request.accept ?? 'application/json,text/csv,application/xml,text/xml,*/*',
      ...request.headers,
      ...auth.headers,
    },
    timeoutMs: request.timeoutMs,
    retries: request.retries,
  }

  // Zonder compressie kan het antwoord direct als tekst worden gelezen.
  if (compression === 'none') {
    return { body: await fetchText(request.url, options), url: request.url }
  }

  // Gecomprimeerde feeds komen als bytes binnen; fetch pakt content-encoding
  // zelf uit, maar een .gz-bestand is gewoon een gzip-payload.
  const bytes = await fetchBinary(request.url, options)
  if (compression === 'gzip' || (compression === 'auto' && looksGzipped(bytes))) {
    logger.debug('Feed gzip uitgepakt', { url: request.url, bytes: bytes.byteLength })
    return { body: gunzipSync(bytes).toString('utf8'), url: request.url }
  }
  if (compression === 'zip' || (compression === 'auto' && looksZipped(bytes))) {
    logger.debug('Feed zip uitgepakt', { url: request.url, bytes: bytes.byteLength })
    return { body: unzipFirstEntry(bytes), url: request.url }
  }
  return { body: new TextDecoder().decode(bytes), url: request.url }
}
