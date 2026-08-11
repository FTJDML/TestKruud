/**
 * Constanten die zowel de server als de client nodig heeft. Bewust apart van
 * `queries.ts`, zodat client components geen Prisma importeren.
 */

/** Vanaf hoeveel echte saves we een aantal tonen. */
export const MIN_VISIBLE_SAVE_COUNT = 10
