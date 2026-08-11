import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { demoProducts } from '@/merchants/fixtures/demo-products'
import { buildTemplateContent } from '@/lib/ai/template'
import { ANTHROPIC_SYSTEM_PROMPT, buildFactsPrompt } from '@/lib/ai/anthropic'
import type { ProductFacts } from '@/lib/ai/provider'

/**
 * De zin "Wij verkopen zelf niets" mag nergens meer staan: niet in de UI, niet
 * in fixtures, niet in AI-instructies en niet in documenten die nieuwe content
 * kunnen beïnvloeden. Deze test scant de repository, zodat de zin ook niet via
 * een nieuw bestand terugkomt.
 */
const root = join(import.meta.dirname, '..', '..')
const scannedExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.css',
  '.html',
  '.prisma',
  '.sql',
  '.svg',
  '.yml',
  '.yaml',
])
const skippedDirectories = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  '.turbo',
  '.vercel',
])

function collectFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    if (skippedDirectories.has(entry)) continue
    const full = join(directory, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      collectFiles(full, found)
      continue
    }
    if (scannedExtensions.has(extname(entry))) found.push(full)
  }
  return found
}

const files = collectFiles(root)

/** Deze test noemt de zin zelf; hij mag zichzelf niet als vondst rapporteren. */
const thisFile = join(import.meta.dirname, 'copy-hygiene.test.ts')

/** Varianten van dezelfde belofte; alle even ongewenst. */
const forbiddenPhrases = [
  'verkopen zelf niets',
  'verkopen niets zelf',
  'wij verkopen niets',
  'verkoopt zelf niets',
]

const facts: ProductFacts = {
  title: 'Nocta Bijzettafel met ingebouwde koeling',
  brand: 'Nocta',
  model: 'CT-40',
  primaryCategory: 'Wonen & Design',
  shortSourceDescription: 'Ronde bijzettafel van 40 cm met een gekoeld compartiment onder het blad',
  specifications: { Diameter: '40 cm' },
  merchantName: 'Huisvondst',
  currentPriceCents: 29_900,
  isDemo: false,
}

describe('de zin "Wij verkopen zelf niets"', () => {
  it('scant een repository met broncode, documenten en fixtures', () => {
    // Zonder bestanden zou de test niets bewijzen.
    expect(files.length).toBeGreaterThan(50)
    expect(files.some((file) => file.endsWith('src/components/layout/SiteFooter.tsx'))).toBe(true)
  })

  it('komt nergens in de repository voor', () => {
    const hits: string[] = []
    for (const file of files) {
      if (file === thisFile) continue
      const contents = readFileSync(file, 'utf8').toLowerCase()
      for (const phrase of forbiddenPhrases) {
        if (contents.includes(phrase)) hits.push(`${relative(root, file)}: ${phrase}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('komt niet in de demo-fixtures voor', () => {
    const text = JSON.stringify(demoProducts).toLowerCase()
    for (const phrase of forbiddenPhrases) {
      expect(text, phrase).not.toContain(phrase)
    }
  })

  it('komt niet in gegenereerde templatecontent voor', () => {
    const content = buildTemplateContent(facts).content
    const text = JSON.stringify(content).toLowerCase()
    for (const phrase of forbiddenPhrases) {
      expect(text, phrase).not.toContain(phrase)
    }
  })

  it('komt niet in de AI-instructies voor', () => {
    const text = `${ANTHROPIC_SYSTEM_PROMPT}\n${buildFactsPrompt(facts)}`.toLowerCase()
    for (const phrase of forbiddenPhrases) {
      expect(text, phrase).not.toContain(phrase)
    }
  })
})

describe('vaste teksten in de UI', () => {
  function read(path: string): string {
    return readFileSync(join(root, path), 'utf8')
  }

  it('gebruikt de afgesproken kop in de header', () => {
    expect(read('src/components/layout/SiteHeader.tsx')).toContain(
      'Elke dag nieuwe vondsten · Prijzen dagelijks gecontroleerd',
    )
  })

  it('gebruikt de afgesproken tekst in de footer', () => {
    expect(read('src/components/layout/SiteFooter.tsx')).toContain(
      'Bijzondere producten, actuele prijzen en opvallende prijsdalingen voor thuis en dagelijks leven.',
    )
  })

  it('noemt de methodologie "Onafhankelijke selectie"', () => {
    expect(read('src/components/editorial/MethodologyBlock.tsx')).toContain('Onafhankelijke selectie')
  })

  it('heeft één affiliate-disclosure met de afgesproken zin', () => {
    const component = read('src/components/ui/AffiliateDisclosure.tsx')
    expect(component).toContain(
      'Sommige links zijn affiliatelinks. Bij een aankoop kunnen wij een commissie ontvangen.',
    )
    // De zin staat op precies één plek in de broncode.
    const occurrences = files.filter(
      (file) =>
        file !== thisFile &&
        readFileSync(file, 'utf8').includes(
          'Sommige links zijn affiliatelinks. Bij een aankoop kunnen wij een commissie ontvangen.',
        ),
    )
    expect(occurrences.map((file) => relative(root, file))).toEqual([
      'src/components/ui/AffiliateDisclosure.tsx',
    ])
  })
})
