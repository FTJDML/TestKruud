type Level = 'debug' | 'info' | 'warn' | 'error'

type Fields = Record<string, unknown>

/**
 * Veldnamen die nooit in een logregel horen. De waarde wordt vervangen door
 * "[verborgen]"; de sleutel blijft staan zodat een logregel nog leesbaar is.
 */
const secretKeys = [
  'password',
  'wachtwoord',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'sessie',
  'session',
  'databaseurl',
  'database_url',
  'connectionstring',
]

const REDACTED = '[verborgen]'

function isSecretKey(key: string): boolean {
  const lowered = key.toLowerCase()
  return secretKeys.some((secret) => lowered.includes(secret))
}

/** Verwijdert secrets uit een tekstwaarde (bijvoorbeeld een foutmelding). */
function redactText(value: string): string {
  return value
    .replace(/(postgres(?:ql)?:\/\/)[^\s"']+/gi, `$1${REDACTED}`)
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,})/gi, REDACTED)
}

function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactText(value)
  if (value === null || typeof value !== 'object' || depth > 4) return value
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1))
  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSecretKey(key) ? REDACTED : redact(entry, depth + 1)
  }
  return output
}

/** Alleen geëxporteerd om te kunnen testen dat er niets uitlekt. */
export function redactFields(fields: Fields): Fields {
  return redact(fields) as Fields
}

function emit(level: Level, message: string, fields?: Fields): void {
  const safeFields = fields ? redactFields(fields) : undefined
  const line =
    safeFields && Object.keys(safeFields).length > 0
      ? `${redactText(message)} ${JSON.stringify(safeFields)}`
      : redactText(message)
  const stamped = `[${level.toUpperCase()}] ${line}`
  if (level === 'error') console.error(stamped)
  else if (level === 'warn') console.warn(stamped)
  else if (level === 'debug' && process.env.NODE_ENV === 'production') return
  else console.info(stamped)
}

export const logger = {
  debug: (message: string, fields?: Fields) => emit('debug', message, fields),
  info: (message: string, fields?: Fields) => emit('info', message, fields),
  warn: (message: string, fields?: Fields) => emit('warn', message, fields),
  error: (message: string, fields?: Fields) => emit('error', message, fields),
}

export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)
  return redactText(raw)
}
