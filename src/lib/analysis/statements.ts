import { formatMoney } from '@/lib/pricing/money'
import type { PriceAnalysis } from '@/lib/analysis/price-analysis'

/**
 * Zet een prijsanalyse om in Nederlandse zinnen. Elke zin bestaat alleen wanneer
 * de onderliggende data haar draagt: geen dertigdagenclaim zonder dertig dagen
 * historie, geen mediaanclaim zonder mediaan, geen vergelijking zonder tweede
 * aanbieder. Wat hier niet uitkomt, staat niet op de pagina.
 */
export type PriceStatement = {
  /** Stabiele sleutel, handig in tests en voor styling. */
  key:
    | 'onder-mediaan'
    | 'boven-mediaan'
    | 'prijsdaling'
    | 'prijsstijging'
    | 'laagste-30-dagen'
    | 'laagste-ooit'
    | 'goedkoopste-aanbieder'
    | 'geen-historie'
  text: string
  tone: 'deal' | 'neutraal'
}

const DAY_MS = 24 * 60 * 60 * 1000

function sameDay(left: Date, right: Date): boolean {
  return Math.abs(left.getTime() - right.getTime()) < DAY_MS
}

function euro(cents: number): string {
  return formatMoney(Math.abs(cents))
}

export function priceStatements(analysis: PriceAnalysis, now: Date = new Date()): PriceStatement[] {
  const statements: PriceStatement[] = []

  // 1. Verhouding tot de eigen 90-dagenmediaan.
  const median = analysis.medianPrice90DaysCents
  if (median !== null && median > 0) {
    const difference = analysis.currentPriceCents - median
    const percentage = Math.abs(Math.round((difference / median) * 100))
    if (difference < 0 && percentage >= 1) {
      statements.push({
        key: 'onder-mediaan',
        tone: 'deal',
        text: `Deze prijs ligt ${percentage}% onder onze 90-dagenmediaan.`,
      })
    } else if (difference > 0 && percentage >= 1) {
      statements.push({
        key: 'boven-mediaan',
        tone: 'neutraal',
        text: `Deze prijs ligt ${percentage}% boven onze 90-dagenmediaan.`,
      })
    }
  }

  // 2. Recente prijswijziging, alleen wanneer wij haar zelf hebben gemeten.
  const change = analysis.priceChangeAmountCents
  if (change !== null && change !== 0 && analysis.lastPriceChangeAt) {
    const when = sameDay(analysis.lastPriceChangeAt, now)
      ? 'vandaag'
      : `op ${new Intl.DateTimeFormat('nl-NL', {
          day: 'numeric',
          month: 'long',
          timeZone: 'Europe/Amsterdam',
        }).format(analysis.lastPriceChangeAt)}`
    statements.push(
      change < 0
        ? {
            key: 'prijsdaling',
            tone: 'deal',
            text: `De prijs is ${when} ${euro(change)} gedaald.`,
          }
        : {
            key: 'prijsstijging',
            tone: 'neutraal',
            text: `De prijs is ${when} ${euro(change)} gestegen.`,
          },
    )
  }

  // 3. Laagste door ons gemeten prijs.
  const lowest30 = analysis.lowestPrice30DaysCents
  if (lowest30 !== null && analysis.currentPriceCents <= lowest30) {
    statements.push({
      key: 'laagste-30-dagen',
      tone: 'deal',
      text: 'Laagste door ons gemeten prijs in 30 dagen.',
    })
  }
  const lowestEver = analysis.lowestPriceAllTimeCents
  if (
    lowestEver !== null &&
    analysis.currentPriceCents <= lowestEver &&
    analysis.numberOfObservedPrices >= 5 &&
    // Niet twee keer bijna hetzelfde zeggen.
    !(lowest30 !== null && analysis.currentPriceCents <= lowest30 && analysis.historyDays < 60)
  ) {
    statements.push({
      key: 'laagste-ooit',
      tone: 'deal',
      text: `Laagste prijs die wij ooit voor dit product hebben gemeten (${analysis.numberOfObservedPrices} metingen).`,
    })
  }

  // 4. Vergelijking met de volgende aangesloten aanbieder.
  const difference = analysis.differenceToNextMerchantCents
  if (difference !== null && difference > 0 && analysis.numberOfComparedMerchants >= 2) {
    const basis =
      analysis.comparisonBasis === 'prijs-en-verzending' ? ' (inclusief verzendkosten)' : ''
    statements.push({
      key: 'goedkoopste-aanbieder',
      tone: 'deal',
      text: `Momenteel ${euro(difference)} goedkoper dan de volgende aangesloten aanbieder${basis}.`,
    })
  }

  // 5. Eerlijk zijn wanneer er nog niets te zeggen valt.
  if (statements.length === 0) {
    statements.push({
      key: 'geen-historie',
      tone: 'neutraal',
      text:
        analysis.numberOfObservedPrices <= 1
          ? 'Wij volgen deze prijs sinds kort; er is nog te weinig historie voor een vergelijking.'
          : `Wij hebben ${analysis.numberOfObservedPrices} prijsmetingen; nog te weinig voor een uitspraak over 30 of 90 dagen.`,
    })
  }

  return statements
}
