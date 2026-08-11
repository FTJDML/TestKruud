import * as cheerio from 'cheerio'
import { z } from 'zod'
import { parseCsv } from '@/lib/scraping/csv'
import { normalizeEan } from '@/lib/scraping/normalize'
import { categoryNames } from '@/lib/categories'

/**
 * Open Icecat-adapter: **productgegevens, nooit prijzen**.
 *
 * Icecat levert catalogusgegevens die door merken worden aangeleverd: titel,
 * merk, model, EAN, categorie, specificaties en afbeeldingen. Er zit geen
 * winkelprijs en geen voorraad in, en die verzinnen wij hier dus ook niet. Het
 * type dat deze adapter teruggeeft heeft daar geen veld voor; een prijs komt
 * uitsluitend uit de handmatige offerimport.
 *
 * Waarom bestandsgebaseerd: een export van je eigen Open Icecat-account is het
 * enige dat wij nodig hebben, en zo werkt de import zonder dat er permanente
 * credentials in de repository of in de omgeving hoeven te staan. Levert jouw
 * account een URL, dan haalt het importscript die op met de sleutel uit een
 * environment-variabele; de sleutel zelf staat nooit in de configuratie.
 *
 * Drie formaten, één resultaat. Icecat bestanden verschillen per account en per
 * exportkeuze, dus alle veldnamen zijn in te stellen; de standaardnamen dekken
 * de gangbare kolommen en knopen.
 */

/** Waar een afbeelding op gebruikt mag worden. Zonder grondslag: niet importeren. */
export const DEFAULT_ALLOWED_USAGE = ['open icecat', 'openicecat', 'open', 'free', 'public'] as const

/** Een specificatie is pas bruikbaar met een naam én een waarde. */
export const MIN_SPECIFICATIONS = 5

export const openIcecatMappingSchema = z.object({
  ean: z.array(z.string()).default(['ean_upcs', 'ean_upc', 'ean', 'gtin', 'gtins', 'barcode']),
  productId: z.array(z.string()).default(['icecat_id', 'product_id', 'prod_id_icecat', 'id']),
  title: z.array(z.string()).default(['title', 'producttitle', 'product_name', 'productname', 'name']),
  brand: z.array(z.string()).default(['supplier', 'brand', 'vendor', 'manufacturer']),
  model: z.array(z.string()).default(['prod_id', 'model_name', 'model', 'mpn', 'partnumber']),
  category: z.array(z.string()).default(['category', 'catname', 'category_name', 'categoryname']),
  imageUrl: z.array(z.string()).default(['highpic', 'high_pic', 'pic500x500', 'image', 'imageurl', 'picture']),
  imageWidth: z.array(z.string()).default(['highpicwidth', 'image_width', 'picwidth']),
  imageHeight: z.array(z.string()).default(['highpicheight', 'image_height', 'picheight']),
  /** Kolom die zegt of de gegevens open zijn, bijvoorbeeld "Open Icecat". */
  usage: z.array(z.string()).default(['limited', 'openicecat', 'quality', 'usage', 'license']),
  manufacturerUrl: z.array(z.string()).default(['supplier_url', 'brandurl', 'manufacturer_url']),
  /** Kolom met alle specificaties in één veld: `Naam=Waarde;Naam=Waarde`. */
  specifications: z.array(z.string()).default(['specifications', 'features', 'specs']),
  /** Voorvoegsel voor losse specificatiekolommen, bijvoorbeeld `spec:Gewicht`. */
  specificationPrefix: z.string().default('spec:'),
})

export type OpenIcecatMapping = z.infer<typeof openIcecatMappingSchema>

export const openIcecatOptionsSchema = z.object({
  format: z.enum(['csv', 'xml', 'json']),
  mapping: openIcecatMappingSchema.default(() => openIcecatMappingSchema.parse({})),
  /** Icecat-categorienaam naar onze categorie; per regel een zoekwoord. */
  categoryRules: z
    .array(
      z.object({
        match: z.string().min(2),
        // Alleen een bestaande categorie van deze site; een typefout in een
        // mappingbestand mag geen nieuwe categorie laten ontstaan.
        category: z.string().refine((value) => categoryNames.includes(value), {
          message: 'onbekende categorie',
        }),
      }),
    )
    .default([]),
  allowedUsage: z.array(z.string()).default([...DEFAULT_ALLOWED_USAGE]),
  /**
   * De operator verklaart dat zijn account de assets in dit bestand mag
   * gebruiken. Alleen dan mogen rijen zonder expliciete gebruikskolom mee, en
   * dan wordt die verklaring als grondslag vastgelegd.
   */
  usageBasis: z.string().min(3).nullable().default(null),
  minSpecifications: z.number().int().min(1).default(MIN_SPECIFICATIONS),
})

/**
 * De invoer van de adapter. `categoryRules` mag readonly zijn, zodat de
 * regelset uit `src/lib/launch/catalogue.ts` er rechtstreeks in kan.
 */
export type OpenIcecatOptions = Omit<z.input<typeof openIcecatOptionsSchema>, 'categoryRules'> & {
  categoryRules?: readonly { match: string; category: string }[]
}

/**
 * Eén product uit de catalogus. Er is bewust geen veld voor prijs, korting,
 * voorraad of winkel: die gegevens komen niet uit Icecat.
 */
export type CatalogProduct = {
  /** EAN wanneer de bron er een levert; anders null. */
  ean: string | null
  /** Sleutel bij de bron; samen met `ean` de identiteit van de rij. */
  sourceRef: string
  title: string
  brand: string
  model: string
  /** Categorienaam zoals de bron haar levert. */
  sourceCategory: string
  /** Onze categorie, uit de mappingregels. */
  primaryCategory: string
  specifications: Record<string, string>
  imageUrl: string
  imageWidth: number | null
  imageHeight: number | null
  /** Waarop het gebruik van de afbeelding rust; nooit leeg. */
  imageUsageBasis: string
  imageAttribution: string
  manufacturerName: string
  manufacturerUrl: string | null
}

export type SkipReason =
  | 'geen titel'
  | 'geen merk'
  | 'geen model'
  | 'geen ean of bron-id'
  | 'geen afbeelding'
  | 'afbeelding niet toegestaan'
  | 'te weinig specificaties'
  | 'categorie past niet bij Home & Living'
  | 'dubbel in het bestand'

export type OpenIcecatResult = {
  products: CatalogProduct[]
  /** Per reden hoeveel rijen zijn overgeslagen. Nooit stil weglaten. */
  skipped: Record<SkipReason, number>
  warnings: string[]
  /** Aantal rijen dat het bestand bevatte. */
  rows: number
}

function emptySkipped(): Record<SkipReason, number> {
  return {
    'geen titel': 0,
    'geen merk': 0,
    'geen model': 0,
    'geen ean of bron-id': 0,
    'geen afbeelding': 0,
    'afbeelding niet toegestaan': 0,
    'te weinig specificaties': 0,
    'categorie past niet bij Home & Living': 0,
    'dubbel in het bestand': 0,
  }
}

/** Losse rij zoals uit een bestand komt: platte sleutels met tekstwaarden. */
type RawRow = Record<string, string> & { __specifications?: Record<string, string> }

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function pick(row: RawRow, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = row[normalizeKey(key)]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

function parseNumber(value: string | null): number | null {
  if (value === null) return null
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** `Naam=Waarde;Naam=Waarde` of JSON in één kolom. */
function parseSpecificationField(value: string | null): Record<string, string> {
  if (!value) return {}
  const trimmed = value.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const result: Record<string, string> = {}
        for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof entry === 'string' || typeof entry === 'number') result[key.trim()] = String(entry).trim()
        }
        return result
      }
    } catch {
      // Geen JSON; hieronder als sleutel-waardelijst lezen.
    }
  }
  const result: Record<string, string> = {}
  for (const pair of trimmed.split(/[;|]/)) {
    const [key, ...rest] = pair.split(/[:=]/)
    const label = (key ?? '').trim()
    const entry = rest.join('=').trim()
    if (label.length > 0 && entry.length > 0) result[label] = entry
  }
  return result
}

/**
 * Sleutels en waarden die op een prijs lijken. Een catalogusbestand bevat soms
 * een adviesprijs, maar dat is geen winkelprijs: hij heeft geen winkel, geen
 * datum en geen voorraad. Zo'n waarde mag dus ook niet als specificatie op de
 * pagina belanden, want daar leest een bezoeker haar als prijs.
 */
const priceLikeKey = /prijs|price|msrp|rrp|advies|valuta|currency|btw|vat/i
const priceLikeValue = /(^|\s)[€$£]\s?\d|\d[\d.,]*\s?(eur|euro|usd|gbp|€|\$|£)\b/i

/** Houdt alleen specificaties over die een mens iets zeggen. */
function usableSpecifications(input: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.replace(/\s+/g, ' ').trim()
    const value = rawValue.replace(/\s+/g, ' ').trim()
    if (key.length < 2 || value.length === 0) continue
    if (priceLikeKey.test(key) || priceLikeValue.test(value)) continue
    // "n.v.t." en "-" zijn geen gegeven.
    if (/^(n\.?v\.?t\.?|onbekend|unknown|none|-{1,3}|0)$/i.test(value)) continue
    if (value.length > 160) continue
    result[key] = value
  }
  return result
}

function usageAllowed(
  value: string | null,
  options: z.infer<typeof openIcecatOptionsSchema>,
): { ok: boolean; basis: string } {
  const text = (value ?? '').trim().toLowerCase()
  if (text.length > 0) {
    // Icecat noteert een niet-open datasheet als "Limited: Yes".
    if (/^(no|false|0)$/.test(text)) return { ok: true, basis: 'open-icecat' }
    for (const allowed of options.allowedUsage) {
      if (text.includes(allowed.toLowerCase())) return { ok: true, basis: `open-icecat (${text})` }
    }
    if (/^(yes|true|1|limited)$/.test(text)) return { ok: false, basis: '' }
  }
  // Geen kolom: alleen mee wanneer de operator een grondslag heeft opgegeven.
  if (options.usageBasis) return { ok: true, basis: options.usageBasis }
  return { ok: false, basis: '' }
}

function mapCategory(
  sourceCategory: string,
  title: string,
  rules: z.infer<typeof openIcecatOptionsSchema>['categoryRules'],
): string | null {
  const haystack = `${sourceCategory} ${title}`.toLowerCase()
  for (const rule of rules) {
    if (haystack.includes(rule.match.toLowerCase())) return rule.category
  }
  return null
}

/** CSV: kolomnamen genormaliseerd, plus losse `spec:`-kolommen. */
function rowsFromCsv(text: string, mapping: OpenIcecatMapping): RawRow[] {
  const table = parseCsv(text)
  return table.map((entry) => {
    const row: RawRow = {}
    const specifications: Record<string, string> = {}
    for (const [rawKey, rawValue] of Object.entries(entry)) {
      const value = typeof rawValue === 'string' ? rawValue : ''
      if (rawKey.toLowerCase().startsWith(mapping.specificationPrefix.toLowerCase())) {
        specifications[rawKey.slice(mapping.specificationPrefix.length).trim()] = value
        continue
      }
      row[normalizeKey(rawKey)] = value
    }
    if (Object.keys(specifications).length > 0) row.__specifications = specifications
    return row
  })
}

/**
 * XML: de Icecat-productstructuur, tolerant gelezen. Attributen en knopen
 * hebben per export andere namen, dus beide worden geprobeerd.
 */
function rowsFromXml(text: string, mapping: OpenIcecatMapping): RawRow[] {
  const $ = cheerio.load(text, { xml: { xmlMode: true, decodeEntities: true } })
  const nodes = $('Product, product').toArray().filter((node) => {
    // Genestelde <Product> in een <ProductRelated> hoort niet als eigen rij mee.
    const parents = $(node).parents().toArray()
    return !parents.some((parent) => /productrelated|relatedproduct/i.test(parent.tagName ?? ''))
  })

  return nodes.map((node) => {
    const element = $(node)
    const row: RawRow = {}

    for (const [name, value] of Object.entries(element.attr() ?? {})) {
      if (typeof value === 'string') row[normalizeKey(name)] = value
    }

    // Losse knopen met een Value-attribuut of tekst.
    element.children().each((_index, child) => {
      const tag = normalizeKey(child.tagName ?? '')
      if (tag.length === 0 || tag === 'productfeature') return
      const value = $(child).attr('Value') ?? $(child).attr('value') ?? $(child).text()
      if (typeof value === 'string' && value.trim().length > 0 && !(tag in row)) {
        row[tag] = value.trim()
      }
      // <Supplier Name="..."> en <Category><Name Value="..."/></Category>
      const named = $(child).attr('Name') ?? $(child).attr('name')
      if (typeof named === 'string' && named.trim().length > 0) row[tag] = named.trim()
      const nestedName = $(child).find('Name').first().attr('Value')
      if (typeof nestedName === 'string' && nestedName.trim().length > 0) row[tag] = nestedName.trim()
      const nestedUrl = $(child).attr('LowPic') ?? $(child).attr('HighPic')
      if (typeof nestedUrl === 'string' && nestedUrl.trim().length > 0) {
        row[normalizeKey(mapping.imageUrl[0] ?? 'highpic')] = nestedUrl.trim()
      }
    })

    // EAN staat vaak als <EANCode><EAN_UPC Value="..."/></EANCode>. De omhullende
    // knoop komt in documentorde eerst en is leeg, dus wij nemen de eerste knoop
    // die werkelijk een waarde heeft.
    const eanValue = element
      .find('EAN_UPC, EANCode, GTIN, EAN')
      .toArray()
      .map((node) => $(node).attr('Value') ?? $(node).attr('value') ?? $(node).text())
      .find((value) => typeof value === 'string' && value.trim().length > 0)
    if (typeof eanValue === 'string') row.ean_upcs = eanValue.trim()

    const specifications: Record<string, string> = {}
    element.find('ProductFeature').each((_index, feature) => {
      const node$ = $(feature)
      const name =
        node$.find('Name').first().attr('Value') ??
        node$.find('Feature > Name').first().attr('Value') ??
        node$.attr('Name')
      const value = node$.attr('PresentationValue') ?? node$.attr('Value') ?? node$.text()
      const measure = node$.find('Measure > Signs > Sign').first().text()
      if (typeof name === 'string' && typeof value === 'string' && name.trim() && value.trim()) {
        specifications[name.trim()] = `${value.trim()}${measure ? ` ${measure.trim()}` : ''}`.trim()
      }
    })
    if (Object.keys(specifications).length > 0) row.__specifications = specifications
    return row
  })
}

/** JSON: een lijst platte objecten, of de Icecat Live-structuur per product. */
function rowsFromJson(text: string, mapping: OpenIcecatMapping): RawRow[] {
  const parsed: unknown = JSON.parse(text)
  const candidates: unknown[] = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null
      ? ((): unknown[] => {
          const record = parsed as Record<string, unknown>
          if (Array.isArray(record.products)) return record.products
          if (Array.isArray(record.Products)) return record.Products
          if (Array.isArray(record.data)) return record.data
          return [parsed]
        })()
      : []

  return candidates.flatMap((candidate): RawRow[] => {
    if (!candidate || typeof candidate !== 'object') return []
    const record = candidate as Record<string, unknown>
    const row: RawRow = {}
    const specifications: Record<string, string> = {}

    // Icecat Live: { data: { GeneralInfo, Image, FeaturesGroups } }
    const data = (record.data ?? record) as Record<string, unknown>
    const general = data.GeneralInfo as Record<string, unknown> | undefined
    const image = data.Image as Record<string, unknown> | undefined

    if (general) {
      const brand = general.Brand ?? general.SupplierName
      const title = general.Title ?? general.ProductName ?? general.TitleInfo
      const category = general.Category as Record<string, unknown> | undefined
      const categoryName = category?.Name as Record<string, unknown> | string | undefined
      if (typeof brand === 'string') row.supplier = brand
      if (typeof title === 'string') row.title = title
      else if (title && typeof title === 'object') {
        const generated = (title as Record<string, unknown>).GeneratedLocalTitle
        const value = generated && typeof generated === 'object'
          ? (generated as Record<string, unknown>).Value
          : undefined
        if (typeof value === 'string') row.title = value
      }
      if (typeof general.ProductName === 'string') row.prod_id = general.ProductName
      if (typeof general.BrandPartCode === 'string') row.prod_id = general.BrandPartCode
      if (typeof general.IcecatId === 'number' || typeof general.IcecatId === 'string') {
        row.icecat_id = String(general.IcecatId)
      }
      if (typeof categoryName === 'string') row.category = categoryName
      else if (categoryName && typeof categoryName === 'object') {
        const value = (categoryName as Record<string, unknown>).Value
        if (typeof value === 'string') row.category = value
      }
      const gtins = general.GTIN
      if (Array.isArray(gtins) && typeof gtins[0] === 'string') row.ean_upcs = gtins[0]
      const brandInfo = general.BrandInfo as Record<string, unknown> | undefined
      const brandUrl = brandInfo?.BrandLocalURL ?? brandInfo?.BrandURL
      if (typeof brandUrl === 'string') row.supplier_url = brandUrl
    }

    if (image) {
      const high = image.HighPic ?? image.Pic500x500 ?? image.LowPic
      if (typeof high === 'string') row[normalizeKey(mapping.imageUrl[0] ?? 'highpic')] = high
      if (typeof image.HighPicWidth === 'number') row.highpicwidth = String(image.HighPicWidth)
      if (typeof image.HighPicHeight === 'number') row.highpicheight = String(image.HighPicHeight)
    }

    const groups = data.FeaturesGroups
    if (Array.isArray(groups)) {
      for (const group of groups) {
        const features = (group as Record<string, unknown>)?.Features
        if (!Array.isArray(features)) continue
        for (const entry of features) {
          const feature = (entry as Record<string, unknown>)?.Feature as Record<string, unknown> | undefined
          const nameNode = feature?.Name as Record<string, unknown> | undefined
          const name = nameNode?.Value
          const value =
            (entry as Record<string, unknown>)?.PresentationValue ??
            (entry as Record<string, unknown>)?.Value
          if (typeof name === 'string' && (typeof value === 'string' || typeof value === 'number')) {
            specifications[name] = String(value)
          }
        }
      }
    }

    // Platte export: alle overige sleutels gewoon overnemen.
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const normalized = normalizeKey(key)
        if (!(normalized in row)) row[normalized] = String(value)
      }
      if (normalizeKey(key) === 'specifications' && value && typeof value === 'object') {
        for (const [specKey, specValue] of Object.entries(value as Record<string, unknown>)) {
          if (typeof specValue === 'string' || typeof specValue === 'number') {
            specifications[specKey] = String(specValue)
          }
        }
      }
    }

    if (Object.keys(specifications).length > 0) row.__specifications = specifications
    return [row]
  })
}

/**
 * Leest een Open Icecat-export en levert alleen producten die publicabel zijn:
 * met EAN of bron-id, merk, model, genoeg specificaties, een toegestane
 * afbeelding en een categorie die bij deze site past.
 */
export function parseOpenIcecatExport(text: string, input: OpenIcecatOptions): OpenIcecatResult {
  const options = openIcecatOptionsSchema.parse(input)
  const mapping = options.mapping
  const rows =
    options.format === 'csv'
      ? rowsFromCsv(text, mapping)
      : options.format === 'xml'
        ? rowsFromXml(text, mapping)
        : rowsFromJson(text, mapping)

  const skipped = emptySkipped()
  const warnings: string[] = []
  const products: CatalogProduct[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const title = pick(row, mapping.title)
    if (!title || title.length < 4) {
      skipped['geen titel'] += 1
      continue
    }
    const brand = pick(row, mapping.brand)
    if (!brand) {
      skipped['geen merk'] += 1
      continue
    }
    const model = pick(row, mapping.model)
    if (!model) {
      skipped['geen model'] += 1
      continue
    }

    const ean = normalizeEan(pick(row, mapping.ean))
    const productId = pick(row, mapping.productId)
    if (!ean && !productId) {
      skipped['geen ean of bron-id'] += 1
      continue
    }
    const sourceRef = ean ?? `icecat:${productId}`
    if (seen.has(sourceRef)) {
      skipped['dubbel in het bestand'] += 1
      continue
    }

    const imageUrl = pick(row, mapping.imageUrl)
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      skipped['geen afbeelding'] += 1
      continue
    }

    const usage = usageAllowed(pick(row, mapping.usage), options)
    if (!usage.ok) {
      skipped['afbeelding niet toegestaan'] += 1
      continue
    }

    const specifications = usableSpecifications({
      ...parseSpecificationField(pick(row, mapping.specifications)),
      ...(row.__specifications ?? {}),
    })
    if (Object.keys(specifications).length < options.minSpecifications) {
      skipped['te weinig specificaties'] += 1
      continue
    }

    const sourceCategory = pick(row, mapping.category) ?? ''
    const primaryCategory = mapCategory(sourceCategory, title, options.categoryRules)
    if (!primaryCategory) {
      skipped['categorie past niet bij Home & Living'] += 1
      continue
    }

    seen.add(sourceRef)
    products.push({
      ean,
      sourceRef,
      title,
      brand,
      model,
      sourceCategory,
      primaryCategory,
      specifications,
      imageUrl,
      imageWidth: parseNumber(pick(row, mapping.imageWidth)),
      imageHeight: parseNumber(pick(row, mapping.imageHeight)),
      imageUsageBasis: usage.basis,
      imageAttribution: `Productgegevens en afbeelding via Open Icecat, aangeleverd door ${brand}`,
      manufacturerName: brand,
      manufacturerUrl: pick(row, mapping.manufacturerUrl),
    })
  }

  if (rows.length === 0) warnings.push('het bestand leverde geen rijen op')
  if (products.length === 0 && rows.length > 0) {
    warnings.push('geen enkele rij haalde de eisen; controleer de veldmapping en de categorieregels')
  }

  return { products, skipped, warnings, rows: rows.length }
}
