/**
 * Genereert originele, abstracte SVG-placeholders voor de demo-producten.
 * Geen externe assets, geen gelicentieerde afbeeldingen. Deterministisch:
 * dezelfde bestandsnaam levert altijd dezelfde illustratie op.
 *
 * Gebruik: node scripts/generate-demo-images.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = join(root, 'src/merchants/fixtures/demo-products.ts')
const outputDir = join(root, 'public/demo')

const palettes = {
  'Wonen & Design': ['#F1EBE4', '#E4D6C8', '#C8A48A', '#FF5B4D'],
  'Keuken & Apparaten': ['#F0EFE9', '#DDE3DA', '#9FB6A4', '#FF5B4D'],
  'Smart Home & Tech': ['#ECEFF3', '#D8E0EA', '#9CAFC6', '#FF5B4D'],
  'Gaming & Entertainment': ['#EEECF4', '#DCD8EA', '#A79FC4', '#FF5B4D'],
  'Tuin & Buitenleven': ['#EDF1E8', '#D7E2CD', '#9CB585', '#FF5B4D'],
  'Auto & Onderweg': ['#EDEEEF', '#DADDE0', '#9BA3A9', '#FF5B4D'],
  'Speelgoed & Hobby': ['#F3EFE6', '#E7DCC6', '#C9AE7E', '#FF5B4D'],
  'Comfort & Gemak': ['#F1EEEC', '#E1DAD6', '#B8A9A1', '#FF5B4D'],
  'Onnodig Maar Geweldig': ['#FFF1EE', '#FBDCD6', '#F0A99C', '#FF5B4D'],
  Cadeaus: ['#F2EEF1', '#E3DAE1', '#B7A2B2', '#FF5B4D'],
}

const fallbackPalette = ['#F7F7F4', '#E8E8E4', '#B0B0A8', '#FF5B4D']

function seedFrom(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRandom(seed) {
  let state = seed || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
}

function parseFixtures() {
  const source = readFileSync(fixturePath, 'utf8')
  const blocks = source.split("    externalId: '").slice(1)
  return blocks
    .map((block) => {
      const image = block.match(/image: '([^']+)'/)
      const category = block.match(/primaryCategory: '([^']+)'/)
      return image && category ? { image: image[1], category: category[1] } : null
    })
    .filter(Boolean)
}

/** Bouwt een abstracte compositie van rustige vormen. */
function buildSvg({ image, category }) {
  const palette = palettes[category] ?? fallbackPalette
  const [background, mid, deep, accent] = palette
  const random = createRandom(seedFrom(image))
  const size = 800

  const shapes = []
  // Grote basisvorm: een zachte, afgeronde rechthoek of cirkel.
  const baseIsCircle = random() > 0.45
  const baseSize = 340 + Math.round(random() * 110)
  const baseX = 400 - baseSize / 2 + Math.round((random() - 0.5) * 60)
  const baseY = 430 - baseSize / 2 + Math.round((random() - 0.5) * 40)
  shapes.push(
    baseIsCircle
      ? `<circle cx="${baseX + baseSize / 2}" cy="${baseY + baseSize / 2}" r="${baseSize / 2}" fill="${mid}"/>`
      : `<rect x="${baseX}" y="${baseY}" width="${baseSize}" height="${baseSize}" rx="${48 + Math.round(random() * 40)}" fill="${mid}"/>`,
  )

  // Twee ondersteunende vormen die de vorm een silhouet geven.
  for (let index = 0; index < 2; index += 1) {
    const width = 120 + Math.round(random() * 200)
    const height = 60 + Math.round(random() * 200)
    const x = 120 + Math.round(random() * 420)
    const y = 180 + Math.round(random() * 380)
    const fill = index === 0 ? deep : background
    const opacity = index === 0 ? 0.9 : 0.75
    shapes.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.round(Math.min(width, height) / 2)}" fill="${fill}" opacity="${opacity}"/>`,
    )
  }

  // Eén klein koraalaccent: de rode draad van het merk.
  const accentSize = 40 + Math.round(random() * 46)
  shapes.push(
    `<circle cx="${210 + Math.round(random() * 380)}" cy="${230 + Math.round(random() * 300)}" r="${accentSize / 2}" fill="${accent}"/>`,
  )

  // Horizon: geeft de compositie een vloer om op te staan.
  shapes.push(`<rect x="0" y="640" width="${size}" height="4" fill="${deep}" opacity="0.35"/>`)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">
  <rect width="${size}" height="${size}" fill="${background}"/>
  ${shapes.join('\n  ')}
  <text x="${size - 28}" y="${size - 26}" text-anchor="end" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" fill="${deep}" opacity="0.75">demo</text>
</svg>
`
}

function main() {
  const fixtures = parseFixtures()
  if (fixtures.length === 0) {
    throw new Error('Geen demo-producten gevonden in de fixtures.')
  }
  mkdirSync(outputDir, { recursive: true })
  for (const fixture of fixtures) {
    writeFileSync(join(outputDir, `${fixture.image}.svg`), buildSvg(fixture), 'utf8')
  }
  // Neutrale placeholder voor producten zonder eigen illustratie.
  writeFileSync(
    join(outputDir, 'placeholder.svg'),
    buildSvg({ image: 'placeholder', category: 'Comfort & Gemak' }),
    'utf8',
  )
  console.log(`${fixtures.length + 1} demo-illustraties geschreven naar public/demo`)
}

main()
