import { cookies } from 'next/headers'

/** Naam van de first-party cookie met het anonieme bezoekers-ID. */
export const VISITOR_COOKIE = 'hald_vid'
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Genereert een anoniem bezoekers-ID; bevat geen persoonsgegevens. */
export function createVisitorId(): string {
  return crypto.randomUUID()
}

export function isValidVisitorId(value: string | undefined | null): boolean {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
}

/** Leest het bezoekers-ID in server components en route handlers. */
export async function readVisitorId(): Promise<string | null> {
  const store = await cookies()
  const value = store.get(VISITOR_COOKIE)?.value
  return isValidVisitorId(value) ? (value as string) : null
}
