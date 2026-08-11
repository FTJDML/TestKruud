import { describe, expect, it } from 'vitest'
import { parseOpenIcecatExport, MIN_SPECIFICATIONS } from '@/merchants/adapters/open-icecat'
import { launchCategoryRules } from '@/lib/launch/catalogue'

/**
 * De Open Icecat-adapter levert catalogusgegevens en nooit prijzen. Deze tests
 * leggen de eisen vast waaraan een rij moet voldoen voordat zij een product
 * wordt: EAN of bron-id, merk, model, vijf bruikbare specificaties, een
 * toegestane afbeelding en een categorie die bij deze site past.
 */
const rules = launchCategoryRules

function csvRow(overrides: Record<string, string> = {}): string {
  const columns = {
    ean_upcs: '8712345678901',
    icecat_id: '1234567',
    title: 'Nordwind Vapor stoomoven met kerntemperatuurmeter',
    supplier: 'Nordwind',
    prod_id: 'VP-38',
    category: 'Ovens',
    highpic: 'https://images.icecat.biz/img/gallery/1234567_stoomoven.jpg',
    highpicwidth: '1500',
    highpicheight: '1500',
    limited: 'No',
    'spec:Inhoud': '38 liter',
    'spec:Standen': 'stoom, hetelucht, combi',
    'spec:Afmetingen': '54 x 42 x 35 cm',
    'spec:Waterreservoir': '1,2 liter',
    'spec:Vermogen': '1800 W',
    ...overrides,
  }
  const header = Object.keys(columns).join(',')
  const values = Object.values(columns)
    .map((value) => (/[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value))
    .join(',')
  return `${header}\n${values}\n`
}

describe('Open Icecat: CSV', () => {
  it('leest een volledige rij en legt de rechten vast', () => {
    const result = parseOpenIcecatExport(csvRow(), { format: 'csv', categoryRules: rules })
    expect(result.products).toHaveLength(1)
    const product = result.products[0]!
    expect(product.ean).toBe('8712345678901')
    expect(product.brand).toBe('Nordwind')
    expect(product.model).toBe('VP-38')
    expect(product.primaryCategory).toBe('Keuken & Apparaten')
    expect(Object.keys(product.specifications).length).toBe(5)
    expect(product.imageUrl).toContain('images.icecat.biz')
    expect(product.imageWidth).toBe(1500)
    // Zonder vastgelegde grondslag hoort een afbeelding niet publiek te staan.
    expect(product.imageUsageBasis).toContain('open-icecat')
    expect(product.imageAttribution).toContain('Open Icecat')
    expect(product.manufacturerName).toBe('Nordwind')
  })

  it('geeft geen enkel prijs- of voorraadveld terug, ook niet als specificatie', () => {
    const result = parseOpenIcecatExport(
      csvRow({ price: '499,00', stock: 'ja', 'spec:Prijs': '499,00' }),
      { format: 'csv', categoryRules: rules },
    )
    const product = result.products[0]!
    // Een adviesprijs uit een catalogusbestand is geen winkelprijs: geen winkel,
    // geen datum, geen voorraad. Hij hoort hier niet, ook niet als specificatie.
    expect(Object.keys(product)).not.toContain('price')
    expect(Object.keys(product)).not.toContain('currentPriceCents')
    expect(Object.keys(product)).not.toContain('inStock')
    expect(JSON.stringify(product)).not.toContain('499,00')
  })

  it('weigert een rij zonder afbeelding', () => {
    const result = parseOpenIcecatExport(csvRow({ highpic: '' }), { format: 'csv', categoryRules: rules })
    expect(result.products).toHaveLength(0)
    expect(result.skipped['geen afbeelding']).toBe(1)
  })

  it('weigert een afbeelding zonder toegestaan gebruik', () => {
    const result = parseOpenIcecatExport(csvRow({ limited: 'Yes' }), {
      format: 'csv',
      categoryRules: rules,
    })
    expect(result.products).toHaveLength(0)
    expect(result.skipped['afbeelding niet toegestaan']).toBe(1)
  })

  it('laat een rij zonder gebruikskolom alleen mee met een verklaarde grondslag', () => {
    const zonder = csvRow().replace(',limited', ',ongebruikt').replace(/,No(,|\n)/, ',No$1')
    const geweigerd = parseOpenIcecatExport(zonder, { format: 'csv', categoryRules: rules })
    expect(geweigerd.products).toHaveLength(0)

    const toegestaan = parseOpenIcecatExport(zonder, {
      format: 'csv',
      categoryRules: rules,
      usageBasis: 'Open Icecat-account 12345, assets toegestaan',
    })
    expect(toegestaan.products).toHaveLength(1)
    expect(toegestaan.products[0]!.imageUsageBasis).toContain('12345')
  })

  it(`weigert een rij met minder dan ${MIN_SPECIFICATIONS} bruikbare specificaties`, () => {
    const result = parseOpenIcecatExport(csvRow({ 'spec:Vermogen': '', 'spec:Waterreservoir': 'n.v.t.' }), {
      format: 'csv',
      categoryRules: rules,
    })
    expect(result.products).toHaveLength(0)
    expect(result.skipped['te weinig specificaties']).toBe(1)
  })

  it('weigert een categorie die niet bij deze site past', () => {
    const result = parseOpenIcecatExport(csvRow({ category: 'Autoradios', title: 'Autoradio met DAB' }), {
      format: 'csv',
      categoryRules: rules,
    })
    expect(result.products).toHaveLength(0)
    expect(result.skipped['categorie past niet bij Home & Living']).toBe(1)
  })

  it('houdt hetzelfde EAN maar één keer', () => {
    const twice = `${csvRow()}${csvRow().split('\n')[1]}\n`
    const result = parseOpenIcecatExport(twice, { format: 'csv', categoryRules: rules })
    expect(result.products).toHaveLength(1)
    expect(result.skipped['dubbel in het bestand']).toBe(1)
  })

  it('valt terug op het bron-id wanneer een EAN ontbreekt', () => {
    const result = parseOpenIcecatExport(csvRow({ ean_upcs: '' }), { format: 'csv', categoryRules: rules })
    expect(result.products).toHaveLength(1)
    expect(result.products[0]!.ean).toBeNull()
    expect(result.products[0]!.sourceRef).toBe('icecat:1234567')
  })
})

describe('Open Icecat: XML', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ICECAT-interface>
  <Product Code="9876543" Prod_id="RS-500" Title="Stofveeg RS-500 robotstofzuiger met dweilfunctie" Quality="ICECAT" HighPic="https://images.icecat.biz/img/gallery/9876543_robot.jpg" HighPicWidth="1200" HighPicHeight="1200" Limited="No">
    <Supplier Name="Stofveeg" ID="42"/>
    <Category><Name Value="Robotstofzuigers"/></Category>
    <EANCode><EAN_UPC Value="8798765432109"/></EANCode>
    <ProductFeature PresentationValue="4000" >
      <Feature><Name Value="Zuigkracht"/></Feature>
      <Measure><Signs><Sign>Pa</Sign></Signs></Measure>
    </ProductFeature>
    <ProductFeature PresentationValue="62"><Feature><Name Value="Geluidsniveau"/></Feature><Measure><Signs><Sign>dB</Sign></Signs></Measure></ProductFeature>
    <ProductFeature PresentationValue="laser"><Feature><Name Value="Navigatie"/></Feature></ProductFeature>
    <ProductFeature PresentationValue="aanwezig"><Feature><Name Value="Dweilfunctie"/></Feature></ProductFeature>
    <ProductFeature PresentationValue="30 dagen"><Feature><Name Value="Zelflegend station"/></Feature></ProductFeature>
  </Product>
</ICECAT-interface>`

  it('leest attributen, categorie, EAN en specificaties met eenheid', () => {
    const result = parseOpenIcecatExport(xml, { format: 'xml', categoryRules: rules })
    expect(result.products).toHaveLength(1)
    const product = result.products[0]!
    expect(product.ean).toBe('8798765432109')
    expect(product.brand).toBe('Stofveeg')
    expect(product.model).toBe('RS-500')
    expect(product.primaryCategory).toBe('Comfort & Gemak')
    expect(product.specifications.Zuigkracht).toBe('4000 Pa')
    expect(product.specifications.Geluidsniveau).toBe('62 dB')
    expect(Object.keys(product.specifications).length).toBe(5)
  })
})

describe('Open Icecat: JSON', () => {
  const json = JSON.stringify({
    data: {
      GeneralInfo: {
        IcecatId: 5551234,
        Brand: 'Skylite',
        BrandPartCode: 'MP-720',
        Title: 'Skylite MP-720 mini thuisprojector',
        Category: { Name: { Value: 'Projectoren' } },
        GTIN: ['8791234567890'],
        BrandInfo: { BrandLocalURL: 'https://voorbeeldmerk.nl' },
      },
      Image: { HighPic: 'https://images.icecat.biz/img/gallery/5551234_projector.jpg', HighPicWidth: 1000, HighPicHeight: 1000 },
      FeaturesGroups: [
        {
          Features: [
            { Feature: { Name: { Value: 'Helderheid' } }, PresentationValue: '450 ANSI lumen' },
            { Feature: { Name: { Value: 'Resolutie' } }, PresentationValue: '1920 x 1080' },
            { Feature: { Name: { Value: 'Aansluitingen' } }, PresentationValue: 'HDMI, USB-C' },
            { Feature: { Name: { Value: 'Geluid' } }, PresentationValue: '2x 5 W' },
            { Feature: { Name: { Value: 'Projectieafstand' } }, PresentationValue: '1,2 tot 3,5 m' },
          ],
        },
      ],
    },
  })

  it('leest de Icecat Live-structuur', () => {
    const result = parseOpenIcecatExport(json, {
      format: 'json',
      categoryRules: rules,
      usageBasis: 'Open Icecat-account, assets toegestaan',
    })
    expect(result.products).toHaveLength(1)
    const product = result.products[0]!
    expect(product.ean).toBe('8791234567890')
    expect(product.brand).toBe('Skylite')
    expect(product.model).toBe('MP-720')
    expect(product.primaryCategory).toBe('Gaming & Entertainment')
    expect(product.manufacturerUrl).toBe('https://voorbeeldmerk.nl')
    expect(product.specifications.Helderheid).toBe('450 ANSI lumen')
  })

  it('meldt het wanneer een bestand niets bruikbaars levert', () => {
    const result = parseOpenIcecatExport('[]', { format: 'json', categoryRules: rules })
    expect(result.products).toHaveLength(0)
    expect(result.warnings.join(' ')).toContain('geen rijen')
  })
})
