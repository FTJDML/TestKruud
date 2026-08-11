type Level = 'debug' | 'info' | 'warn' | 'error'

type Fields = Record<string, unknown>

function emit(level: Level, message: string, fields?: Fields): void {
  const line = fields && Object.keys(fields).length > 0
    ? `${message} ${JSON.stringify(fields)}`
    : message
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
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : JSON.stringify(error)
}
