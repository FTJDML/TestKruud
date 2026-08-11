import type { CriterionValueType } from '@prisma/client'

/**
 * Bibliotheek met vergelijkingscriteria.
 *
 * Criteria zijn herbruikbaar over pagina's, zodat "bonenreservoir" op elke
 * pagina hetzelfde betekent en dezelfde eenheid heeft. Dit bestand bevat alleen
 * definities — nooit waarden: een waarde hoort bij één product op één pagina en
 * komt uit een bron.
 *
 * `higherIsBetter` is `null` wanneer "hoger" niets zegt (een kleur, een
 * materiaal). Zulke criteria tellen niet mee in de rangorde.
 */
export type CriterionSeed = {
  name: string
  label: string
  valueType: CriterionValueType
  unit: string | null
  sourceRequired: boolean
  higherIsBetter: boolean | null
  explanation: string
  displayOrder: number
}

export const comparisonCriteriaSeeds: readonly CriterionSeed[] = [
  // Koffie en keuken
  {
    name: 'grind-settings',
    label: 'Maalgraden',
    valueType: 'NUMBER',
    unit: 'standen',
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Aantal instelbare maalgraden volgens de fabrikant; meer standen geeft fijnere controle.',
    displayOrder: 10,
  },
  {
    name: 'bean-hopper',
    label: 'Bonenreservoir',
    valueType: 'NUMBER',
    unit: 'g',
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Inhoud van het bonenreservoir in gram, zoals opgegeven door de fabrikant.',
    displayOrder: 11,
  },
  {
    name: 'burr-type',
    label: 'Type maalwerk',
    valueType: 'TEXT',
    unit: null,
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Kegel-, vlakke of slagmolen volgens de documentatie; smaakvoorkeur, geen ranglijst.',
    displayOrder: 12,
  },
  {
    name: 'water-tank',
    label: 'Waterreservoir',
    valueType: 'NUMBER',
    unit: 'l',
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Inhoud van het waterreservoir in liter volgens de fabrikant.',
    displayOrder: 13,
  },
  {
    name: 'power',
    label: 'Vermogen',
    valueType: 'NUMBER',
    unit: 'W',
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Opgegeven vermogen in watt; meer vermogen is niet automatisch beter.',
    displayOrder: 14,
  },
  // Smart home en schoonmaak
  {
    name: 'suction-power',
    label: 'Zuigkracht',
    valueType: 'NUMBER',
    unit: 'Pa',
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Zuigkracht in pascal volgens de fabrikant; alleen vergelijkbaar binnen hetzelfde meetsysteem.',
    displayOrder: 20,
  },
  {
    name: 'dustbin-capacity',
    label: 'Stofbak',
    valueType: 'NUMBER',
    unit: 'ml',
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Inhoud van de stofbak in milliliter volgens de fabrikant.',
    displayOrder: 21,
  },
  {
    name: 'noise-level',
    label: 'Geluidsniveau',
    valueType: 'NUMBER',
    unit: 'dB',
    sourceRequired: true,
    higherIsBetter: false,
    explanation: 'Opgegeven geluidsniveau in decibel; lager is stiller. Nooit onze eigen indruk.',
    displayOrder: 22,
  },
  {
    name: 'battery-runtime',
    label: 'Looptijd accu',
    valueType: 'NUMBER',
    unit: 'min',
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Opgegeven looptijd in minuten volgens de fabrikant.',
    displayOrder: 23,
  },
  {
    name: 'app-required',
    label: 'App nodig',
    valueType: 'BOOLEAN',
    unit: null,
    sourceRequired: true,
    higherIsBetter: false,
    explanation: 'Is een app of account nodig voor de belangrijkste functies?',
    displayOrder: 24,
  },
  // Beeld en geluid
  {
    name: 'brightness',
    label: 'Helderheid',
    valueType: 'NUMBER',
    unit: 'ANSI lumen',
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Helderheid in ANSI lumen; alleen vergelijkbaar wanneer dezelfde eenheid wordt opgegeven.',
    displayOrder: 30,
  },
  {
    name: 'native-resolution',
    label: 'Resolutie',
    valueType: 'TEXT',
    unit: null,
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Werkelijke (native) resolutie volgens de fabrikant, niet de ondersteunde resolutie.',
    displayOrder: 31,
  },
  {
    name: 'throw-distance',
    label: 'Projectieafstand',
    valueType: 'TEXT',
    unit: 'm',
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Afstand die nodig is voor een bepaald beeldformaat; bepaalt of het in je kamer past.',
    displayOrder: 32,
  },
  // Wonen en meubels
  {
    name: 'seats',
    label: 'Zitplaatsen',
    valueType: 'NUMBER',
    unit: 'personen',
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Aantal zitplaatsen volgens de aanbieder.',
    displayOrder: 40,
  },
  {
    name: 'dimensions',
    label: 'Afmetingen',
    valueType: 'TEXT',
    unit: 'cm',
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Breedte × diepte × hoogte volgens de aanbieder; bepaalt of het in je ruimte past.',
    displayOrder: 41,
  },
  {
    name: 'material',
    label: 'Materiaal',
    valueType: 'TEXT',
    unit: null,
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Materiaal van de bekleding of het frame volgens de aanbieder.',
    displayOrder: 42,
  },
  {
    name: 'assembly',
    label: 'Montage',
    valueType: 'TEXT',
    unit: null,
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Hoeveel montage er nodig is volgens de aanbieder.',
    displayOrder: 43,
  },
  {
    name: 'maintenance',
    label: 'Onderhoud',
    valueType: 'TEXT',
    unit: null,
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Reinigings- en onderhoudsinstructie volgens de aanbieder.',
    displayOrder: 44,
  },
  // Tuin
  {
    name: 'mowing-area',
    label: 'Maaioppervlak',
    valueType: 'NUMBER',
    unit: 'm²',
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Maximaal maaioppervlak volgens de fabrikant.',
    displayOrder: 50,
  },
  {
    name: 'weather-resistance',
    label: 'Weerbestendigheid',
    valueType: 'TEXT',
    unit: null,
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'IP-klasse of weerbestendigheid volgens de fabrikant.',
    displayOrder: 51,
  },
  // Speelgoed en cadeaus
  {
    name: 'age-rating',
    label: 'Leeftijdsindicatie',
    valueType: 'TEXT',
    unit: 'jaar',
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Leeftijdsindicatie van de fabrikant. Wij bepalen deze niet zelf.',
    displayOrder: 60,
  },
  {
    name: 'piece-count',
    label: 'Aantal onderdelen',
    valueType: 'NUMBER',
    unit: 'stuks',
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Aantal onderdelen volgens de fabrikant; meer is niet automatisch leuker.',
    displayOrder: 61,
  },
  {
    name: 'batteries-included',
    label: 'Batterijen inbegrepen',
    valueType: 'BOOLEAN',
    unit: null,
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Zitten de benodigde batterijen erbij volgens de aanbieder?',
    displayOrder: 62,
  },
  {
    name: 'ready-to-play',
    label: 'Direct speelbaar',
    valueType: 'BOOLEAN',
    unit: null,
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Kan het meteen uit de doos, of is er montage of een app nodig?',
    displayOrder: 63,
  },
  // Algemeen
  {
    name: 'warranty',
    label: 'Garantie',
    valueType: 'NUMBER',
    unit: 'jaar',
    sourceRequired: true,
    higherIsBetter: true,
    explanation: 'Garantietermijn volgens de aanbieder of fabrikant.',
    displayOrder: 70,
  },
  {
    name: 'weight',
    label: 'Gewicht',
    valueType: 'NUMBER',
    unit: 'kg',
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Gewicht volgens de fabrikant; zwaarder is soms steviger en soms lastiger.',
    displayOrder: 71,
  },
  {
    name: 'footprint',
    label: 'Ruimtegebruik',
    valueType: 'TEXT',
    unit: 'cm',
    sourceRequired: true,
    higherIsBetter: null,
    explanation: 'Hoeveel ruimte het in gebruik vraagt, bijvoorbeeld op een aanrecht of balkon.',
    displayOrder: 72,
  },
]

export function criterionSeedByName(name: string): CriterionSeed | undefined {
  return comparisonCriteriaSeeds.find((criterion) => criterion.name === name)
}
