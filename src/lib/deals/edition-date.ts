/**
 * De dagelijkse editie draait op de Nederlandse kalenderdag. De editiedatum is
 * een DATE-kolom; we bewaren die als UTC-middernacht van de Amsterdamse dag,
 * zodat een refresh binnen dezelfde dag altijd dezelfde editie oplevert.
 */
export const EDITION_TIME_ZONE = 'Europe/Amsterdam'

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EDITION_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Geeft "2026-08-11" voor de Amsterdamse kalenderdag van `now`. */
export function editionDateKey(now: Date = new Date()): string {
  return dateKeyFormatter.format(now)
}

/** Geeft de editiedatum als Date (UTC-middernacht) voor de DATE-kolom. */
export function editionDate(now: Date = new Date()): Date {
  return new Date(`${editionDateKey(now)}T00:00:00.000Z`)
}

const humanFormatter = new Intl.DateTimeFormat('nl-NL', {
  timeZone: EDITION_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** Bijvoorbeeld "dinsdag 11 augustus" voor de editiekop. */
export function formatEditionDate(date: Date): string {
  return humanFormatter.format(date)
}
