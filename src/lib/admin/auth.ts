import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { isAdminConfigured, serverEnv } from '@/lib/env'

export const ADMIN_COOKIE = 'hald_admin'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

type SessionPayload = { username: string; expiresAt: number }

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

/** Maakt een ondertekende sessiewaarde; de cookie zelf is httpOnly. */
export function createSessionToken(username: string, now: number = Date.now()): string {
  const secret = serverEnv().ADMIN_SESSION_SECRET
  const payload: SessionPayload = { username, expiresAt: now + SESSION_TTL_MS }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded, secret)}`
}

export function verifySessionToken(token: string | undefined, now: number = Date.now()): SessionPayload | null {
  if (!token) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null
  const secret = serverEnv().ADMIN_SESSION_SECRET
  if (secret.length === 0) return null
  if (!safeEqual(signature, sign(encoded, secret))) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt < now) return null
    return payload
  } catch {
    return null
  }
}

/** Controleert gebruikersnaam en wachtwoord uit de environment. */
export function checkCredentials(username: string, password: string): boolean {
  if (!isAdminConfigured()) return false
  const env = serverEnv()
  return safeEqual(username, env.ADMIN_USERNAME) && safeEqual(password, env.ADMIN_PASSWORD)
}

export async function readAdminSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value)
}

export async function setAdminCookie(username: string): Promise<void> {
  const store = await cookies()
  store.set({
    name: ADMIN_COOKIE,
    value: createSessionToken(username),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies()
  store.delete(ADMIN_COOKIE)
}
