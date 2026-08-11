import type { ReferencePriceType } from '@prisma/client'
import type { EditorialContentPayload } from '@/lib/ai/schema'

/**
 * Fictieve demo-producten. Alle merken, modellen, prijzen en teksten zijn
 * verzonnen voor deze MVP. Ze worden als `isDemo` opgeslagen en zijn noindex.
 */
export type DemoProduct = {
  externalId: string
  merchantSlug: string
  title: string
  brand: string
  model: string
  ean: string
  primaryCategory: string
  shortSourceDescription: string
  specifications: Record<string, string>
  /** Bestandsnaam van de lokale placeholderillustratie in /public/demo. */
  image: string
  imageAlt: string
  priceCents: number
  referencePriceCents: number | null
  referencePriceType: ReferencePriceType | null
  inStock: boolean
  /** Hoeveel dagen geleden wij dit product ontdekten (voor freshness). */
  discoveredDaysAgo: number
  /** Alleen gevuld wanneer er een echte einddatum bekend is. */
  promotionEndsInHours?: number
  collections: string[]
  editorial: EditorialContentPayload
}

export const demoProducts: readonly DemoProduct[] = [
  {
    externalId: 'HV-1001',
    merchantSlug: 'demo-huisvondst',
    title: 'Nocta Bijzettafel met ingebouwde koeling',
    brand: 'Nocta',
    model: 'CT-40',
    ean: '8712345000011',
    primaryCategory: 'Wonen & Design',
    shortSourceDescription:
      'Ronde bijzettafel van 40 cm met een gekoeld compartiment onder het blad en twee USB-C-aansluitingen in de rand.',
    specifications: {
      Diameter: '40 cm',
      Hoogte: '52 cm',
      Koelcompartiment: '4 liter',
      Aansluitingen: '2x USB-C',
      Geluid: '38 dB',
    },
    image: 'bijzettafel-koeling',
    imageAlt: 'Illustratie van een ronde bijzettafel met een koel compartiment onder het tafelblad',
    priceCents: 29900,
    referencePriceCents: 39900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 0,
    promotionEndsInHours: 36,
    collections: ['onnodig-maar-geweldig', 'redactiefavorieten'],
    editorial: {
      headline: 'Deze bijzettafel verstopt een koelkast naast je bank',
      teaser:
        'Aan de buitenkant lijkt het een rustige ronde bijzettafel. Binnenin houdt hij vier liter drinken koud, terwijl de rand ook als laadpunt voor je telefoon werkt. Volstrekt overbodig, totdat je op één avond niet meer wilt opstaan voor iets koud. De aanbieder noemt 38 decibel, dus je hoort hem zachtjes meedraaien.',
      longDescription:
        'Een bijzettafel is normaal het meubel waar je koffie op belandt en waar je verder niet naar kijkt. Deze variant heeft onder het blad een koelcompartiment van vier liter, groot genoeg voor een paar flesjes of een fles wijn. In de rand zitten twee USB-C-aansluitingen, dus je telefoon laadt op dezelfde plek waar je hem toch al neerlegt. Volgens de aanbieder is de tafel 40 centimeter breed en 52 centimeter hoog, wat naast de meeste banken past zonder in de weg te staan. Het geluid van 38 decibel is vergelijkbaar met een zachte koelkast in een stille kamer. Dat is het eerlijke nadeel van dit soort meubels: er zit een compressor in, en die hoor je af en toe. Huisvondst verkoopt en verzendt de tafel; wij verkopen zelf niets en controleren alleen de prijs. Bekijk de productpagina van de aanbieder voor de garantie en de levertijd.',
      whyItStandsOut:
        'Twee functies die je nooit in hetzelfde meubel verwacht, verstopt achter een vorm die gewoon rustig in je kamer staat.',
      bestFor: ['lange avonden op de bank', 'kleine woonkamers', 'wie graag iets verstopt in zijn interieur'],
      caveat: 'Er zit een compressor in: in een stille kamer hoor je hem zachtjes aanslaan.',
      seoTitle: 'Nocta bijzettafel met koeling en USB-C',
      metaDescription:
        'Ronde bijzettafel met een gekoeld compartiment van 4 liter en USB-C in de rand. Actuele prijs bij Huisvondst, dagelijks gecontroleerd.',
      tags: ['wonen', 'design', 'bijzettafel', 'koeling'],
      uniquenessScore: 92,
      storyScore: 90,
      usefulnessScore: 64,
      giftabilityScore: 78,
    },
  },
  {
    externalId: 'AN-2201',
    merchantSlug: 'demo-atelier-noord',
    title: 'Atelier Noord Wolkstoel fauteuil',
    brand: 'Atelier Noord',
    model: 'WK-1',
    ean: '8712345000028',
    primaryCategory: 'Wonen & Design',
    shortSourceDescription:
      'Fauteuil met een ronde, gecapitonneerde zitkuip op een lage stalen voet, geleverd in geweven boucléstof.',
    specifications: {
      Breedte: '96 cm',
      Zithoogte: '41 cm',
      Stof: 'bouclé',
      Frame: 'gepoedercoat staal',
      Gewicht: '19 kg',
    },
    image: 'fauteuil-wolkstoel',
    imageAlt: 'Illustratie van een ronde fauteuil met dikke gecapitonneerde zitkuip op een lage voet',
    priceCents: 44900,
    referencePriceCents: 59900,
    referencePriceType: 'RECOMMENDED_RETAIL_PRICE',
    inStock: true,
    discoveredDaysAgo: 2,
    collections: ['redactiefavorieten'],
    editorial: {
      headline: 'Een fauteuil waar je in zakt in plaats van op zit',
      teaser:
        'De zitkuip is rond, dik en gecapitonneerd, en staat op een voet die er nauwelijks is. Daardoor lijkt de stoel te zweven, terwijl je er juist diep in wegzakt. Met 96 centimeter breed vult hij een hoek van de kamer meteen. Bouclé voelt zacht, maar houdt kattenharen wel graag vast.',
      longDescription:
        'De meeste fauteuils kiezen tussen mooi staan en lekker zitten. Deze probeert beide: een ronde, gecapitonneerde zitkuip die je omsluit, op een lage stalen voet die visueel bijna verdwijnt. Het effect is dat de stoel boven de vloer lijkt te hangen, wat vooral in kleinere kamers prettig werkt omdat je de vloer blijft zien. Volgens de aanbieder is de stoel 96 centimeter breed met een zithoogte van 41 centimeter, dus je zit relatief laag en achterover. Het frame is gepoedercoat staal en de bekleding is bouclé, een geweven stof met kleine lusjes die zacht aanvoelt. Die lusjes zijn ook het aandachtspunt: bouclé houdt haren en pluis makkelijk vast, dus met huisdieren ben je vaker met een kleefroller bezig. Met 19 kilo tilt de stoel nog met twee mensen te verplaatsen. Atelier Noord levert de fauteuil; wij controleren alleen de prijs en verkopen zelf niets.',
      whyItStandsOut:
        'De combinatie van een zware, omsluitende zitkuip met een voet die bijna niet te zien is, geeft de stoel een vorm die je niet snel vergeet.',
      bestFor: ['een leeshoek', 'kleine woonkamers', 'wie van zachte vormen houdt'],
      caveat: 'Bouclé houdt haren en pluis vast; met huisdieren pak je vaker de kleefroller.',
      seoTitle: 'Atelier Noord Wolkstoel fauteuil in bouclé',
      metaDescription:
        'Ronde bouclé-fauteuil met dikke zitkuip op een lage stalen voet. Actuele prijs bij Atelier Noord, dagelijks door ons gecontroleerd.',
      tags: ['wonen', 'design', 'fauteuil', 'bouclé'],
      uniquenessScore: 74,
      storyScore: 70,
      usefulnessScore: 72,
      giftabilityScore: 42,
    },
  },
  {
    externalId: 'AN-2208',
    merchantSlug: 'demo-atelier-noord',
    title: 'Atelier Noord Segment modulaire bureaulamp',
    brand: 'Atelier Noord',
    model: 'SG-3',
    ean: '8712345000035',
    primaryCategory: 'Wonen & Design',
    shortSourceDescription:
      'Bureaulamp uit drie magnetische segmenten die je in verschillende standen kunt combineren, met traploos dimbaar warm licht.',
    specifications: {
      Segmenten: '3 stuks',
      Lichtstroom: '620 lumen',
      Kleurtemperatuur: '2700-4000 K',
      Voeding: 'USB-C',
      Materiaal: 'aluminium',
    },
    image: 'bureaulamp-modulair',
    imageAlt: 'Illustratie van een bureaulamp opgebouwd uit drie losse magnetische segmenten',
    priceCents: 8900,
    referencePriceCents: 11900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 4,
    collections: ['slimmer-wonen-onder-100'],
    editorial: {
      headline: 'Een bureaulamp die je elke week anders in elkaar zet',
      teaser:
        'De lamp bestaat uit drie aluminium segmenten die magnetisch aan elkaar klikken. Je kunt er een klassieke bureaulamp van maken, een lage leeslamp of een staande lijn langs je monitor. Het licht is traploos dimbaar van warm naar koeler wit. De magneten houden goed, maar een stevige duw haalt de bovenste arm er wel af.',
      longDescription:
        'Bureaulampen staan vaak op de verkeerde plek omdat de vorm nu eenmaal vastligt. Deze lamp bestaat uit drie losse aluminium segmenten die met magneten aan elkaar klikken, zodat je de vorm aanpast aan wat je die week doet. Rechtop naast de monitor voor beeldwerk, laag en gebogen voor lezen, of als korte staande streep achter je scherm voor indirect licht. Volgens de aanbieder geeft de lamp 620 lumen en loopt de kleurtemperatuur van 2700 tot 4000 kelvin, dus van avondwarm naar helder werklicht. De voeding gaat via USB-C, wat betekent dat je hem ook op een powerbank kunt aansluiten als je buiten aan tafel werkt. Het aandachtspunt zit in dezelfde magneten die de lamp leuk maken: ze houden de segmenten prima op hun plek, maar bij een flinke duw of een enthousiaste kat schuift het bovenste deel eraf. Atelier Noord verkoopt en verzendt de lamp.',
      whyItStandsOut:
        'De lamp legt geen vorm op, maar laat je per week beslissen of je werklicht, leeslicht of sfeerlicht nodig hebt.',
      bestFor: ['thuiswerkplekken', 'kleine bureaus', 'wie vaak zijn opstelling verandert'],
      caveat: 'De magnetische segmenten schuiven los bij een stevige duw of een nieuwsgierige kat.',
      seoTitle: 'Segment modulaire bureaulamp met USB-C',
      metaDescription:
        'Modulaire bureaulamp uit drie magnetische segmenten, dimbaar en op USB-C. Actuele prijs bij Atelier Noord, dagelijks gecontroleerd.',
      tags: ['wonen', 'verlichting', 'bureaulamp', 'thuiswerken'],
      uniquenessScore: 78,
      storyScore: 66,
      usefulnessScore: 82,
      giftabilityScore: 70,
    },
  },
  {
    externalId: 'KK-3101',
    merchantSlug: 'demo-kookkamer',
    title: 'Fornello Piccolo draagbare pizzaoven',
    brand: 'Fornello',
    model: 'PC-30',
    ean: '8712345000042',
    primaryCategory: 'Keuken & Apparaten',
    shortSourceDescription:
      'Draagbare pizzaoven op gas met een steen van 30 centimeter, opwarmtijd van vijftien minuten en een opklapbare poot.',
    specifications: {
      Steen: '30 cm cordieriet',
      Maximumtemperatuur: '450 °C',
      Opwarmtijd: '15 minuten',
      Brandstof: 'gas',
      Gewicht: '11 kg',
    },
    image: 'pizzaoven-draagbaar',
    imageAlt: 'Illustratie van een compacte draagbare pizzaoven met koepelvorm en pizzasteen',
    priceCents: 21900,
    referencePriceCents: 27900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 1,
    collections: ['redactiefavorieten'],
    editorial: {
      headline: 'Een pizzaoven die op je balkontafel past',
      teaser:
        'Deze oven haalt 450 graden op een steen van dertig centimeter, en dat is precies het verschil tussen een pizza uit de keuken en een pizza met bruine blaasjes op de bodem. Na een kwartier voorwarmen bak je in een paar minuten. De koepel blijft aan de buitenkant erg heet, dus houd kleine handen op afstand.',
      longDescription:
        'Een gewone oven komt zelden boven 250 graden, en dat is de reden dat pizza thuis vaak bleek blijft. Deze draagbare oven werkt op gas en haalt volgens de aanbieder 450 graden op een steen van dertig centimeter cordieriet. Voorwarmen kost ongeveer een kwartier, daarna is een pizza in een paar minuten klaar en kun je er een hele avond doorheen bakken. Met elf kilo en een opklapbare poot til je hem van de schuur naar de balkontafel zonder hulp, wat het verschil maakt tussen een oven die je gebruikt en een oven die blijft staan. De vorm is een koepel, waardoor de hitte boven de pizza blijft hangen in plaats van weg te lopen. Het aandachtspunt is die hitte: de buitenkant van de koepel wordt flink warm, dus zet hem op een stabiele plek en houd kinderen en huisdieren op afstand tijdens het bakken. Kookkamer verkoopt en verzendt dit product.',
      whyItStandsOut:
        'De temperatuur die deze oven haalt kun je met een keukenoven niet benaderen, en juist dat verschil zie je terug in de bodem.',
      bestFor: ['balkons en kleine tuinen', 'pizza-avonden met vrienden', 'wie graag buiten kookt'],
      caveat: 'De buitenkant van de koepel wordt zeer heet en heeft een stabiele, vrije plek nodig.',
      seoTitle: 'Fornello Piccolo draagbare pizzaoven op gas',
      metaDescription:
        'Draagbare gaspizzaoven met steen van 30 cm en 450 °C. Actuele prijs bij Kookkamer, dagelijks door onze redactie gecontroleerd.',
      tags: ['keuken', 'buiten koken', 'pizzaoven', 'gas'],
      uniquenessScore: 80,
      storyScore: 82,
      usefulnessScore: 76,
      giftabilityScore: 74,
    },
  },
  {
    externalId: 'KK-3110',
    merchantSlug: 'demo-kookkamer',
    title: 'Gelato Uno compacte ijsmachine',
    brand: 'Gelato Uno',
    model: 'GU-15',
    ean: '8712345000059',
    primaryCategory: 'Keuken & Apparaten',
    shortSourceDescription:
      'IJsmachine met eigen compressor voor 1,5 liter ijs, zonder dat je de kom eerst in de vriezer moet leggen.',
    specifications: {
      Inhoud: '1,5 liter',
      Koeling: 'eigen compressor',
      Bereidingstijd: '35 minuten',
      Programmas: 'ijs, sorbet, yoghurt',
      Gewicht: '9,5 kg',
    },
    image: 'ijsmachine-compact',
    imageAlt: 'Illustratie van een compacte ijsmachine met ronde kom en bedieningspaneel',
    priceCents: 17900,
    referencePriceCents: 22900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 6,
    collections: ['onnodig-maar-geweldig'],
    editorial: {
      headline: 'IJs maken zonder een dag vooruit te denken',
      teaser:
        'De meeste ijsmachines vragen dat je de kom een nacht eerder in de vriezer legt, waardoor spontaan ijs onmogelijk wordt. Deze heeft een eigen compressor en begint dus meteen. Na ongeveer 35 minuten schep je anderhalve liter uit de kom. Het apparaat weegt bijna tien kilo, dus je zet hem niet zomaar in een keukenkastje.',
      longDescription:
        'Zelf ijs maken loopt bijna altijd stuk op de planning: de kom moet een nacht in de vriezer, en op het moment dat je zin hebt in ijs is die kom net niet koud. Deze machine heeft een eigen compressor, dus je vult hem, kiest een programma en wacht ongeveer 35 minuten. Volgens de aanbieder maakt hij anderhalve liter per keer, met programma’s voor roomijs, sorbet en yoghurtijs. Daarmee wordt ijs iets wat je op een dinsdagavond kunt bedenken in plaats van een project voor het weekend. Je bepaalt zelf hoeveel suiker en room erin gaat, wat vooral prettig is als je iemand in huis hebt met een allergie. Het nadeel van die vrijheid is het formaat: met 9,5 kilo en de ruimte die een compressor nodig heeft, staat dit apparaat op het aanrecht of in de bijkeuken, niet weggeborgen in een kastje. Kookkamer levert en verzendt de machine.',
      whyItStandsOut:
        'Door de eigen compressor verdwijnt de enige echte reden waarom zelf ijs maken meestal niet gebeurt: de wachttijd vooraf.',
      bestFor: ['gezinnen met zoete plannen', 'wie zelf de ingrediënten wil kiezen', 'zomerse weekenden'],
      caveat: 'Met bijna tien kilo en een compressor is dit een apparaat dat blijft staan in plaats van weggeborgen worden.',
      seoTitle: 'Gelato Uno ijsmachine met eigen compressor',
      metaDescription:
        'Compacte ijsmachine met eigen compressor voor 1,5 liter ijs in 35 minuten. Actuele prijs bij Kookkamer, dagelijks gecontroleerd.',
      tags: ['keuken', 'ijsmachine', 'zomer', 'apparaten'],
      uniquenessScore: 72,
      storyScore: 68,
      usefulnessScore: 70,
      giftabilityScore: 66,
    },
  },
  {
    externalId: 'KK-3125',
    merchantSlug: 'demo-kookkamer',
    title: 'Nordwind Vapor stoomoven 38 liter',
    brand: 'Nordwind',
    model: 'VP-38',
    ean: '8712345000066',
    primaryCategory: 'Keuken & Apparaten',
    shortSourceDescription:
      'Vrijstaande combi-stoomoven van 38 liter met vier stoomstanden, kerntemperatuurmeter en een vaatwasserbestendig waterreservoir.',
    specifications: {
      Inhoud: '38 liter',
      Standen: 'stoom, hetelucht, combi',
      Waterreservoir: '1,2 liter',
      Kerntemperatuurmeter: 'meegeleverd',
      Afmetingen: '54 x 42 x 35 cm',
    },
    image: 'stoomoven-vapor',
    imageAlt: 'Illustratie van een vrijstaande stoomoven met glazen deur en waterreservoir',
    priceCents: 47900,
    referencePriceCents: 62900,
    referencePriceType: 'RECOMMENDED_RETAIL_PRICE',
    inStock: true,
    discoveredDaysAgo: 3,
    collections: [],
    editorial: {
      headline: 'Een stoomoven die geen verbouwing nodig heeft',
      teaser:
        'Stoomovens zitten meestal ingebouwd, en dat maakt ze een keukenproject in plaats van een aankoop. Deze staat gewoon op het aanrecht en heeft 38 liter, genoeg voor een braadpan of een plaat brood. De kerntemperatuurmeter neemt het gokwerk bij vlees weg. Reken wel op ruim een halve meter aanrecht die permanent bezet is.',
      longDescription:
        'Wie brood bakt of vis gaart weet dat stoom een verschil maakt dat je met een gewone oven niet nadoet: een korst die knapt in plaats van kruimelt, en vis die niet uitdroogt. Het probleem is dat stoomovens bijna altijd inbouwmodellen zijn, waardoor je eerst een keuken moet verbouwen. Deze oven is vrijstaand, heeft volgens de aanbieder 38 liter inhoud en combineert stoom met hetelucht, zodat je ook kunt afbakken en roosteren. Er zit een kerntemperatuurmeter bij die je in het vlees prikt, wat handig is omdat je dan op temperatuur kookt in plaats van op tijd. Het waterreservoir van 1,2 liter mag in de vaatwasser, en dat maakt het verschil tussen af en toe stomen en het echt gebruiken. Het eerlijke aandachtspunt is het formaat: met 54 bij 42 bij 35 centimeter neemt hij een flink stuk aanrecht in, en dat stuk krijg je niet terug. Kookkamer verzendt dit product.',
      whyItStandsOut:
        'Een techniek die normaal een inbouwkeuken vraagt, staat hier gewoon op het aanrecht met een kerntemperatuurmeter erbij.',
      bestFor: ['brood- en visliefhebbers', 'huurwoningen zonder inbouwoven', 'wie precies wil koken'],
      caveat: 'De oven neemt ruim een halve meter aanrecht in en staat er daarna permanent.',
      seoTitle: 'Nordwind Vapor vrijstaande stoomoven 38 liter',
      metaDescription:
        'Vrijstaande combi-stoomoven van 38 liter met kerntemperatuurmeter. Actuele prijs bij Kookkamer, elke dag door ons gecontroleerd.',
      tags: ['keuken', 'stoomoven', 'bakken', 'apparaten'],
      uniquenessScore: 70,
      storyScore: 64,
      usefulnessScore: 88,
      giftabilityScore: 40,
    },
  },
  {
    externalId: 'SW-4101',
    merchantSlug: 'demo-slimwonen',
    title: 'Lumen Halo slimme sfeerlamp',
    brand: 'Lumen',
    model: 'HL-2',
    ean: '8712345000073',
    primaryCategory: 'Smart Home & Tech',
    shortSourceDescription:
      'Draadloze tafellamp met een ring van kleurled, acht uur accuduur en scènes via app of aanraking op de bovenkant.',
    specifications: {
      Accuduur: '8 uur',
      Kleuren: '16 miljoen',
      Bediening: 'app en aanraking',
      Laden: 'USB-C',
      Spatwaterdicht: 'IPX4',
    },
    image: 'sfeerlamp-halo',
    imageAlt: 'Illustratie van een draadloze tafellamp met verlichte ring op een ronde voet',
    priceCents: 6900,
    referencePriceCents: 8900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 5,
    collections: ['slimmer-wonen-onder-100'],
    editorial: {
      headline: 'Een lamp die je gewoon meeneemt naar buiten',
      teaser:
        'Snoerloze lampen zijn er genoeg, maar de meeste geven één kleur en gaan na twee uur uit. Deze heeft een ring van kleurled, houdt het volgens de aanbieder acht uur vol en is spatwaterdicht. Een tik op de bovenkant wisselt de scène, dus je hoeft je telefoon niet te zoeken. Volle kleuren gaan wel sneller door de accu.',
      longDescription:
        'De prettigste lampen staan zelden bij een stopcontact. Deze tafellamp werkt op een accu die volgens de aanbieder acht uur meegaat, zodat je hem van de eettafel naar de bank naar het balkon verplaatst zonder over snoeren te denken. In de bovenkant zit een ring van kleurled die je via een app instelt, maar ook met een tik op de behuizing wisselt naar een volgende scène. Dat laatste is belangrijker dan het klinkt: een slimme lamp die je telefoon nodig heeft, wordt in de praktijk minder gebruikt. Met IPX4 is de lamp spatwaterdicht, dus een plotselinge zomerbui op het balkon is geen ramp. Laden gaat via USB-C, dezelfde kabel als de meeste telefoons. Het aandachtspunt is de accu in combinatie met kleur: warm wit haalt de acht uur, maar felle blauwe of rode scènes op volle sterkte trekken hem merkbaar sneller leeg. SlimWonen verkoopt en verzendt de lamp; wij controleren de prijs.',
      whyItStandsOut:
        'Slim licht dat je zonder stopcontact en zonder telefoon bedient, wat precies de twee redenen wegneemt waarom sfeerlampen blijven staan.',
      bestFor: ['balkons en tuinen', 'eettafels', 'wie zonder snoer wil verlichten'],
      caveat: 'Felle kleuren op volle sterkte halen de opgegeven acht uur accuduur niet.',
      seoTitle: 'Lumen Halo slimme sfeerlamp op accu',
      metaDescription:
        'Draadloze slimme sfeerlamp met kleurled, acht uur accu en IPX4. Actuele prijs bij SlimWonen, dagelijks door ons gecontroleerd.',
      tags: ['smart home', 'verlichting', 'sfeerlamp', 'accu'],
      uniquenessScore: 64,
      storyScore: 60,
      usefulnessScore: 78,
      giftabilityScore: 80,
    },
  },
  {
    externalId: 'SW-4118',
    merchantSlug: 'demo-slimwonen',
    title: 'Portaal Vision slimme deurbel met pakketmelding',
    brand: 'Portaal',
    model: 'VS-2',
    ean: '8712345000080',
    primaryCategory: 'Smart Home & Tech',
    shortSourceDescription:
      'Slimme deurbel met 2K-camera, lokale opslag op een microSD-kaart en meldingen die onderscheid maken tussen mensen en pakketten.',
    specifications: {
      Resolutie: '2K',
      Opslag: 'microSD, lokaal',
      Beeldhoek: '160 graden',
      Voeding: 'accu of belkabel',
      Abonnement: 'niet vereist',
    },
    image: 'deurbel-vision',
    imageAlt: 'Illustratie van een slimme deurbel met camera-oog en belknop',
    priceCents: 11900,
    referencePriceCents: 14900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 8,
    collections: [],
    editorial: {
      headline: 'Een deurbel die alleen meldt wat je wilt weten',
      teaser:
        'De meeste slimme deurbellen sturen zoveel meldingen dat je ze na een week uitzet. Deze maakt onderscheid tussen een langslopende voorbijganger, iemand die aanbelt en een bezorger met een pakket. Beelden staan lokaal op een microSD-kaart, dus een abonnement is niet nodig. Op accu wil dat wel zeggen dat je hem periodiek moet opladen.',
      longDescription:
        'Slimme deurbellen falen bijna altijd op hetzelfde punt: ze melden alles, waardoor je binnen een week stopt met kijken. Deze deurbel filtert volgens de aanbieder zelf en meldt afzonderlijk of iemand aanbelt, of er iemand langs de deur beweegt en of er een pakket wordt neergezet. Dat laatste is precies de melding waarvoor je zo’n bel eigenlijk ophangt. De camera heeft 2K-resolutie met een beeldhoek van 160 graden, breed genoeg om ook de stoep en een deel van de deurmat te zien. Opnames gaan naar een microSD-kaart in de bel zelf, dus je hebt geen maandelijks abonnement nodig en je beelden blijven in huis. Je kunt kiezen tussen de meegeleverde accu of aansluiten op een bestaande belkabel. Kies je voor de accu, dan is dat ook het aandachtspunt: die haal je er een paar keer per jaar af om te laden, en in die uren kijkt de bel niet mee. SlimWonen verzendt dit product.',
      whyItStandsOut:
        'Lokale opslag zonder abonnement in combinatie met meldingen die onderscheid maken, is een combinatie die je zelden samen ziet.',
      bestFor: ['wie vaak pakketten laat bezorgen', 'huurwoningen', 'privacybewuste huishoudens'],
      caveat: 'Op accu moet je de bel een paar keer per jaar losmaken om te laden.',
      seoTitle: 'Portaal Vision slimme deurbel zonder abonnement',
      metaDescription:
        'Slimme deurbel met 2K-camera, lokale microSD-opslag en pakketmeldingen. Actuele prijs bij SlimWonen, dagelijks gecontroleerd.',
      tags: ['smart home', 'deurbel', 'camera', 'privacy'],
      uniquenessScore: 66,
      storyScore: 58,
      usefulnessScore: 86,
      giftabilityScore: 44,
    },
  },
  {
    externalId: 'SW-4130',
    merchantSlug: 'demo-slimwonen',
    title: 'Botanica Pot slimme plantenpot met waterstand',
    brand: 'Botanica',
    model: 'BP-18',
    ean: '8712345000097',
    primaryCategory: 'Smart Home & Tech',
    shortSourceDescription:
      'Plantenpot met watervoorraad voor vier weken, sensor voor vochtigheid en een lampje dat aangeeft wanneer bijvullen nodig is.',
    specifications: {
      Watervoorraad: '2,2 liter',
      Autonomie: 'tot 4 weken',
      Sensor: 'bodemvochtigheid',
      Diameter: '18 cm',
      Batterij: '2x AA',
    },
    image: 'plantenpot-slim',
    imageAlt: 'Illustratie van een plantenpot met watervoorraad en een klein indicatielampje',
    priceCents: 4900,
    referencePriceCents: 6500,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 9,
    collections: ['slimmer-wonen-onder-100', 'redactiefavorieten'],
    editorial: {
      headline: 'Een plantenpot die je vakantie overleeft',
      teaser:
        'Planten gaan zelden dood door verwaarlozing, maar door een vakantie van drie weken. Deze pot heeft een watervoorraad van ruim twee liter en een sensor die meet hoe vochtig de grond is. Een lampje geeft aan wanneer bijvullen nodig is, in plaats van dat je zelf in de aarde prikt. De sensor loopt op twee AA-batterijen.',
      longDescription:
        'De meeste kamerplanten overleven het dagelijkse leven prima; ze bezwijken tijdens vakanties en drukke weken. Deze pot heeft een reservoir van 2,2 liter onderin en geeft water af op basis van hoe vochtig de aarde daadwerkelijk is, niet op een vast schema. Volgens de aanbieder red je daarmee tot vier weken zonder bijvullen, wat precies de periode is waarin het meestal misgaat. Aan de zijkant zit een lampje dat aangeeft wanneer het reservoir bijna leeg is, zodat je niet meer hoeft te gokken of met je vinger in de potgrond hoeft te voelen. Met een diameter van achttien centimeter past de pot bij middelgrote planten zoals een monstera of een ficus, niet bij een grote vloerplant. Het aandachtspunt is de energie: de sensor werkt op twee AA-batterijen, dus je moet die af en toe vervangen, en als ze leeg zijn stopt de pot met doseren. Voor een cadeau is dat wel iets om te vermelden. SlimWonen verzendt de pot.',
      whyItStandsOut:
        'De pot doseert op werkelijke vochtigheid in plaats van op een timer, waardoor hij ook werkt in een huis zonder vast ritme.',
      bestFor: ['wie vaak weg is', 'beginnende plantenouders', 'cadeaus voor een verhuizing'],
      caveat: 'De sensor werkt op AA-batterijen; zijn die leeg, dan stopt de pot met doseren.',
      seoTitle: 'Botanica slimme plantenpot met waterstand',
      metaDescription:
        'Slimme plantenpot met 2,2 liter voorraad, vochtsensor en bijvulindicatie. Actuele prijs bij SlimWonen, dagelijks gecontroleerd.',
      tags: ['smart home', 'planten', 'gemak', 'cadeau'],
      uniquenessScore: 68,
      storyScore: 62,
      usefulnessScore: 80,
      giftabilityScore: 84,
    },
  },
  {
    externalId: 'SP-5101',
    merchantSlug: 'demo-spelhoek',
    title: 'Skylite Mini thuisprojector met scherpstelling',
    brand: 'Skylite',
    model: 'SM-4',
    ean: '8712345000103',
    primaryCategory: 'Gaming & Entertainment',
    shortSourceDescription:
      'Compacte projector die tot 120 inch projecteert, met automatische scherpstelling, keystone-correctie en ingebouwde speakers.',
    specifications: {
      Beeld: 'tot 120 inch',
      Resolutie: '1080p',
      Helderheid: '450 ISO-lumen',
      Geluid: '2x 5 watt',
      Aansluitingen: 'HDMI, USB-C',
    },
    image: 'projector-skylite',
    imageAlt: 'Illustratie van een compacte thuisprojector die een lichtbundel op een muur werpt',
    priceCents: 24900,
    referencePriceCents: 32900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 2,
    collections: ['redactiefavorieten'],
    editorial: {
      headline: 'Je woonkamermuur wordt een scherm van 120 inch',
      teaser:
        'Een projector opstellen was altijd tien minuten schuiven en draaien voordat het beeld recht stond. Deze stelt zelf scherp en corrigeert de hoek, dus je zet hem op de salontafel en begint. Tot 120 inch beeld met 1080p en speakers erin. In een lichte kamer heb je wel gordijnen nodig.',
      longDescription:
        'Het idee van een projector is prettiger dan het opstellen ervan: schuiven tot het beeld recht is, draaien tot het scherp is, en dan blijkt de tafel te laag. Deze projector stelt automatisch scherp en corrigeert de hoek van het beeld, dus je zet hem neer waar ruimte is en het beeld staat recht. Volgens de aanbieder haalt hij een diagonaal tot 120 inch bij 1080p, met twee speakers van vijf watt zodat je voor een filmavond geen aparte geluidsset nodig hebt. Er zitten HDMI en USB-C op, dus zowel een spelcomputer als een laptop kan er direct op. Met 450 ISO-lumen is dit een projector voor de avond en niet voor de middag: in een lichte kamer wordt het beeld bleek, en dat is het eerlijke aandachtspunt. Met verduisterende gordijnen is het verschil met een televisie op formaat groot. Spelhoek verkoopt en verzendt de projector; wij controleren alleen de prijs.',
      whyItStandsOut:
        'De automatische scherpstelling en hoekcorrectie halen precies de drempel weg die een projector normaal in de kast houdt.',
      bestFor: ['filmavonden', 'gamen op groot formaat', 'kleine woonkamers zonder grote televisie'],
      caveat: 'Met 450 ISO-lumen is verduistering nodig; in daglicht wordt het beeld bleek.',
      seoTitle: 'Skylite Mini thuisprojector tot 120 inch',
      metaDescription:
        'Compacte 1080p-thuisprojector met automatische scherpstelling en speakers. Actuele prijs bij Spelhoek, dagelijks gecontroleerd.',
      tags: ['entertainment', 'projector', 'film', 'gaming'],
      uniquenessScore: 70,
      storyScore: 72,
      usefulnessScore: 82,
      giftabilityScore: 76,
    },
  },
  {
    externalId: 'SP-5115',
    merchantSlug: 'demo-spelhoek',
    title: 'Pixelkast Retro mini-arcadekast',
    brand: 'Pixelkast',
    model: 'RK-1',
    ean: '8712345000110',
    primaryCategory: 'Gaming & Entertainment',
    shortSourceDescription:
      'Arcadekast van 42 centimeter hoog met joystick, zes knoppen en een lijst van vijftig ingebouwde spellen uit de jaren tachtig en negentig.',
    specifications: {
      Hoogte: '42 cm',
      Beeld: '8 inch',
      Bediening: 'joystick en 6 knoppen',
      Spellen: '50 ingebouwd',
      Voeding: 'netstroom',
    },
    image: 'arcadekast-mini',
    imageAlt: 'Illustratie van een kleine arcadekast met joystick, knoppen en beeldscherm',
    priceCents: 13900,
    referencePriceCents: 17900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 7,
    collections: ['onnodig-maar-geweldig'],
    editorial: {
      headline: 'Een arcadekast die op je bureau past',
      teaser:
        'Vijftig spellen, een echte joystick en zes knoppen die klikken zoals ze horen te klikken, in een kast van 42 centimeter hoog. Precies groot genoeg om er staand achter te gaan hangen en klein genoeg voor een bureau of dressoir. Het scherm van acht inch is helder, maar met twee mensen kijk je al snel over elkaars schouder.',
      longDescription:
        'Een arcadekast is een van die dingen die je vroeger in een snackbar zag en waarvan je aannam dat je er nooit een zou hebben. Deze versie is 42 centimeter hoog, heeft een scherm van acht inch en zit vol met vijftig spellen uit de tijd dat een level gewoon moeilijker werd tot je verloor. Belangrijker dan het aantal spellen is de bediening: een echte joystick met een microswitch en zes knoppen, waardoor het spelen anders voelt dan met een moderne controller. De kast werkt op netstroom, dus je zet hem op een vaste plek in plaats van hem mee te nemen. Met dit formaat is het vooral een kast voor één speler: het scherm van acht inch is scherp, maar met twee mensen ernaast wordt het schouderwerk, en dat is het eerlijke aandachtspunt bij spellen die juist om de beurt leuk zijn. Spelhoek verkoopt en verzendt dit product.',
      whyItStandsOut:
        'Het is geen emulator op een tablet maar een echte joystick met knoppen, in een formaat dat gewoon in een woonkamer past.',
      bestFor: ['cadeaus voor wie alles heeft', 'werkkamers', 'gezellige avonden met vrienden'],
      caveat: 'Het scherm van acht inch is prima voor één speler, maar krap om samen naar te kijken.',
      seoTitle: 'Pixelkast Retro mini-arcadekast met 50 spellen',
      metaDescription:
        'Mini-arcadekast van 42 cm met joystick, zes knoppen en 50 spellen. Actuele prijs bij Spelhoek, dagelijks door ons gecontroleerd.',
      tags: ['gaming', 'retro', 'arcade', 'cadeau'],
      uniquenessScore: 88,
      storyScore: 86,
      usefulnessScore: 48,
      giftabilityScore: 90,
    },
  },
  {
    externalId: 'SP-5127',
    merchantSlug: 'demo-spelhoek',
    title: 'Sitwell Arc ergonomische gamingstoel',
    brand: 'Sitwell',
    model: 'AR-9',
    ean: '8712345000127',
    primaryCategory: 'Gaming & Entertainment',
    shortSourceDescription:
      'Gamingstoel met verstelbare lendensteun, 4D-armleuningen en een rugleuning die tot 135 graden kantelt, in mat gewoven stof.',
    specifications: {
      Rugleuning: 'tot 135 graden',
      Armleuningen: '4D verstelbaar',
      Bekleding: 'geweven stof',
      Maximaal: '130 kg',
      Wielen: 'zachte PU-wielen',
    },
    image: 'gamingstoel-arc',
    imageAlt: 'Illustratie van een ergonomische bureaustoel met hoge rugleuning en armleuningen',
    priceCents: 27900,
    referencePriceCents: 36900,
    referencePriceType: 'RECOMMENDED_RETAIL_PRICE',
    inStock: true,
    discoveredDaysAgo: 11,
    collections: [],
    editorial: {
      headline: 'Een gamingstoel zonder racestoellook',
      teaser:
        'De meeste gamingstoelen zien eruit alsof er een sponsorsticker op hoort. Deze heeft matte geweven stof, een verstelbare lendensteun en armleuningen die je in vier richtingen zet. De rugleuning kantelt tot 135 graden voor de pauzes tussendoor. Stof is prettiger op warme dagen dan kunstleer, maar vlekt ook makkelijker.',
      longDescription:
        'Een stoel waarin je vier uur achter elkaar zit, is eigenlijk kantoormeubilair, ook al staat hij naast een spelcomputer. Deze stoel laat de racestoelesthetiek achterwege en kiest matte geweven stof, waardoor hij in een werkkamer niet uit de toon valt. Volgens de aanbieder is de lendensteun in hoogte en diepte verstelbaar, wat het verschil maakt tussen een stoel die bij jouw rug past en een stoel die alleen bij een gemiddelde rug past. De armleuningen bewegen in vier richtingen, zodat je ze onder een bureau of naast een toetsenbord kunt zetten. De rugleuning kantelt tot 135 graden voor de momenten tussen twee potjes, en de zachte PU-wielen rollen ook op een houten vloer zonder krassen. Stof heeft één nadeel tegenover kunstleer: het plakt minder op warme dagen, maar het neemt vlekken sneller op, dus met drinken op het bureau is dat wel iets om rekening mee te houden. Spelhoek levert de stoel.',
      whyItStandsOut:
        'Alle verstelmogelijkheden van een gamingstoel, in een uitvoering die je ook naast een gewoon bureau durft te zetten.',
      bestFor: ['lange sessies', 'thuiswerkers', 'wie een rustige werkkamer wil'],
      caveat: 'Geweven stof neemt vlekken sneller op dan kunstleer en is minder makkelijk af te nemen.',
      seoTitle: 'Sitwell Arc ergonomische gamingstoel in stof',
      metaDescription:
        'Ergonomische gamingstoel met lendensteun, 4D-armleuningen en 135 graden kantelbaar. Actuele prijs bij Spelhoek, dagelijks gecontroleerd.',
      tags: ['gaming', 'ergonomie', 'bureaustoel', 'thuiswerken'],
      uniquenessScore: 56,
      storyScore: 54,
      usefulnessScore: 84,
      giftabilityScore: 46,
    },
  },
  {
    externalId: 'BH-6101',
    merchantSlug: 'demo-buitenhof',
    title: 'Lagune Familie opblaasbaar zwembad 305 cm',
    brand: 'Lagune',
    model: 'LF-305',
    ean: '8712345000134',
    primaryCategory: 'Tuin & Buitenleven',
    shortSourceDescription:
      'Rond opblaasbaar zwembad van 305 centimeter met dubbelwandige bodem, filterpomp en een afvoerventiel met slangaansluiting.',
    specifications: {
      Diameter: '305 cm',
      Hoogte: '76 cm',
      Inhoud: '3.600 liter',
      Filterpomp: 'meegeleverd',
      Opbouwtijd: '30 minuten',
    },
    image: 'zwembad-lagune',
    imageAlt: 'Illustratie van een rond opblaasbaar zwembad met filterpomp ernaast',
    priceCents: 9900,
    referencePriceCents: 13900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 3,
    collections: ['slimmer-wonen-onder-100'],
    editorial: {
      headline: 'Drieduizend liter zomer in een halfuur opgezet',
      teaser:
        'Een bad van ruim drie meter breed dat je in een halfuur opzet en met een filterpomp een paar weken schoon houdt. Dubbelwandige bodem, dus je voelt de tegels eronder niet. Het afvoerventiel past op een tuinslang, wat leeghalen een stuk minder vervelend maakt. Reken op flink wat vlakke ruimte in de tuin.',
      longDescription:
        'Een zwembad in de tuin klinkt als een project, maar dit bad is opgeblazen en gevuld voordat een middag om is. Met een diameter van 305 centimeter en een hoogte van 76 centimeter gaat er volgens de aanbieder ongeveer 3.600 liter in, genoeg om er met een paar kinderen echt in te zitten in plaats van te pootje baden. De bodem is dubbelwandig, waardoor je de stoeptegels of het gras eronder niet voelt en het bad iets langer meegaat. De meegeleverde filterpomp is het onderdeel dat het verschil maakt tussen een bad dat na drie dagen groen wordt en een bad dat je een paar weken gebruikt. Bij het afvoerventiel zit een slangaansluiting, dus je kunt het water gericht wegleiden in plaats van de tuin te overstromen. Het aandachtspunt is de ruimte: je hebt een vlakke plek van ruim drie bij drie meter nodig, en die plek is de hele zomer bezet. Buitenhof verzendt dit product.',
      whyItStandsOut:
        'De combinatie van een echte filterpomp en een afvoerventiel met slangaansluiting maakt dit een bad dat je een seizoen gebruikt, niet één weekend.',
      bestFor: ['gezinnen met kinderen', 'hete weken', 'tuinen met een vlak terras'],
      caveat: 'Je hebt een vlakke plek van ruim drie bij drie meter nodig die de hele zomer bezet blijft.',
      seoTitle: 'Lagune opblaasbaar familiezwembad 305 cm',
      metaDescription:
        'Rond opblaasbaar zwembad van 305 cm met filterpomp en afvoerventiel. Actuele prijs bij Buitenhof, dagelijks door ons gecontroleerd.',
      tags: ['tuin', 'zwembad', 'zomer', 'gezin'],
      uniquenessScore: 58,
      storyScore: 64,
      usefulnessScore: 74,
      giftabilityScore: 52,
    },
  },
  {
    externalId: 'BH-6114',
    merchantSlug: 'demo-buitenhof',
    title: 'Terras Grill balkonbarbecue met windscherm',
    brand: 'Terras',
    model: 'TG-2',
    ean: '8712345000141',
    primaryCategory: 'Tuin & Buitenleven',
    shortSourceDescription:
      'Elektrische barbecue voor balkons met een grillplaat van 42 bij 26 centimeter, opklapbaar windscherm en een vetlade.',
    specifications: {
      Grilloppervlak: '42 x 26 cm',
      Vermogen: '2.000 watt',
      Windscherm: 'opklapbaar',
      Vetlade: 'uitneembaar',
      Snoerlengte: '1,8 meter',
    },
    image: 'balkonbarbecue',
    imageAlt: 'Illustratie van een compacte elektrische barbecue met opklapbaar windscherm',
    priceCents: 8400,
    referencePriceCents: 10900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 6,
    collections: ['slimmer-wonen-onder-100'],
    editorial: {
      headline: 'Barbecueën op een balkon zonder rookoverlast',
      teaser:
        'Houtskool op een balkon is meestal geen optie, en daarmee valt barbecueën in een appartement vaak af. Deze elektrische grill heeft een plaat van 42 bij 26 centimeter en een opklapbaar windscherm, zodat je warmte houdt zonder een rookwolk. De vetlade gaat er los uit. Buurten zonder stopcontact buiten hebben er niets aan.',
      longDescription:
        'Een balkon is precies groot genoeg voor twee stoelen en net te klein voor een barbecue op houtskool, waar in veel appartementen ook regels voor gelden. Deze elektrische variant lost dat op met een grillplaat van 42 bij 26 centimeter en 2.000 watt, genoeg voor vier tot zes stukken vlees of een lading groente per ronde. Het opklapbare windscherm is het onderdeel dat het verschil maakt: het houdt de warmte bij het eten in plaats van in de wind, wat op een hoog balkon zomaar tien minuten verschil in baktijd betekent. De vetlade schuif je er los uit en gaat mee naar de gootsteen, waardoor je na het eten niet met een hele grill in de badkamer staat. Het aandachtspunt is de stroom: met een snoer van 1,8 meter heb je een stopcontact op het balkon of een deur die net open kan, en een verlengsnoer door een schuifpui is niet ideaal. Buitenhof verkoopt dit product.',
      whyItStandsOut:
        'Het opklapbare windscherm maakt van een simpele elektrische grill iets dat op tien hoog ook echt bruikbaar is.',
      bestFor: ['appartementen met balkon', 'kleine terrassen', 'wie geen houtskool mag gebruiken'],
      caveat: 'Met een snoer van 1,8 meter heb je een stopcontact op of direct bij het balkon nodig.',
      seoTitle: 'Terras Grill elektrische balkonbarbecue',
      metaDescription:
        'Elektrische balkonbarbecue met windscherm, vetlade en 2.000 watt. Actuele prijs bij Buitenhof, dagelijks door ons gecontroleerd.',
      tags: ['tuin', 'barbecue', 'balkon', 'buiten koken'],
      uniquenessScore: 62,
      storyScore: 60,
      usefulnessScore: 80,
      giftabilityScore: 58,
    },
  },
  {
    externalId: 'BH-6127',
    merchantSlug: 'demo-buitenhof',
    title: 'Gazon Robot slimme tuinrobot zonder perimeterdraad',
    brand: 'Gazon',
    model: 'GR-500',
    ean: '8712345000158',
    primaryCategory: 'Tuin & Buitenleven',
    shortSourceDescription:
      'Robotmaaier voor tuinen tot 500 vierkante meter die de tuin met sensoren in kaart brengt, zonder perimeterdraad, met regensensor.',
    specifications: {
      Oppervlak: 'tot 500 m²',
      Perimeterdraad: 'niet nodig',
      Maaihoogte: '20-60 mm',
      Regensensor: 'aanwezig',
      Geluid: '58 dB',
    },
    image: 'tuinrobot-gazon',
    imageAlt: 'Illustratie van een robotmaaier die een baan door het gras rijdt',
    priceCents: 64900,
    referencePriceCents: 84900,
    referencePriceType: 'RECOMMENDED_RETAIL_PRICE',
    inStock: true,
    discoveredDaysAgo: 4,
    collections: ['redactiefavorieten'],
    editorial: {
      headline: 'Een robotmaaier die geen draad in je tuin nodig heeft',
      teaser:
        'Bij de meeste robotmaaiers begint het met een middag draad ingraven langs elke rand. Deze brengt de tuin met sensoren zelf in kaart en houdt tot 500 vierkante meter bij. De regensensor stuurt hem naar binnen voordat het gras plakt. Met 58 decibel is hij hoorbaar, dus je zet hem liever niet om zeven uur aan.',
      longDescription:
        'Het vervelendste van een robotmaaier is de installatie: een perimeterdraad die je langs elke rand, elke boom en elk bloembed moet ingraven, en die daarna kapot gaat op het moment dat je gaat spitten. Deze maaier laat dat achterwege en gebruikt sensoren om de tuin zelf in kaart te brengen, waarna hij volgens de aanbieder tot 500 vierkante meter bijhoudt. De maaihoogte stel je in tussen 20 en 60 millimeter, dus zowel een kort strak gazon als een iets ruiger grasveld is mogelijk. Er zit een regensensor in die hem terugstuurt naar het laadstation voordat het gras nat en plakkerig wordt, wat de kwaliteit van het maaien merkbaar beter houdt. Het aandachtspunt is geluid: 58 decibel is niet stil, ongeveer een gesprek op normale toon, dus vroeg in de ochtend of laat op de avond maaien zal je buren opvallen. Buitenhof verkoopt en verzendt de robot; wij verkopen zelf niets.',
      whyItStandsOut:
        'Zonder perimeterdraad verdwijnt de hele installatiemiddag die robotmaaiers normaal zo’n drempel maakt.',
      bestFor: ['tuinen tot 500 vierkante meter', 'wie geen draad wil ingraven', 'drukke gezinnen'],
      caveat: 'Met 58 decibel is de robot hoorbaar; vroeg in de ochtend maaien valt de buren op.',
      seoTitle: 'Gazon Robot robotmaaier zonder perimeterdraad',
      metaDescription:
        'Slimme robotmaaier tot 500 m² zonder perimeterdraad, met regensensor. Actuele prijs bij Buitenhof, dagelijks gecontroleerd.',
      tags: ['tuin', 'robot', 'gazon', 'smart home'],
      uniquenessScore: 76,
      storyScore: 66,
      usefulnessScore: 90,
      giftabilityScore: 38,
    },
  },
  {
    externalId: 'OW-7101',
    merchantSlug: 'demo-onderwegshop',
    title: 'Rondweg Compressor draagbare autocompressor',
    brand: 'Rondweg',
    model: 'RC-12',
    ean: '8712345000165',
    primaryCategory: 'Auto & Onderweg',
    shortSourceDescription:
      'Draadloze compressor met digitale drukmeter die automatisch stopt op de ingestelde spanning, inclusief adapters voor fietsen en ballen.',
    specifications: {
      Maximumdruk: '10,3 bar',
      Accu: '2.000 mAh',
      'Automatische stop': 'ja',
      Adapters: 'auto, fiets, bal',
      Gewicht: '580 gram',
    },
    image: 'autocompressor',
    imageAlt: 'Illustratie van een compacte draadloze compressor met digitale drukmeter',
    priceCents: 4400,
    referencePriceCents: 5900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 10,
    collections: ['slimmer-wonen-onder-100'],
    editorial: {
      headline: 'Pompen tot precies de juiste spanning, dan stopt hij zelf',
      teaser:
        'Je stelt de gewenste spanning in, drukt op start en de compressor stopt zelf op precies die waarde. Geen tankstation, geen munten, geen twijfel of het genoeg is. Met adapters voor fietsen en ballen is hij vaker nodig dan alleen voor de auto. De accu van 2.000 mAh is genoeg voor één set autobanden, niet meer.',
      longDescription:
        'Bandenspanning controleren is precies het klusje dat je uitstelt tot de lamp op het dashboard gaat branden. Deze compressor is draadloos, weegt 580 gram en past in het zijvak van je portier. Je stelt de gewenste spanning in, hij pompt en stopt automatisch op die waarde, zodat je niet met een aparte drukmeter hoeft te controleren of het genoeg is. Volgens de aanbieder haalt hij 10,3 bar, meer dan een auto nodig heeft en genoeg voor racefietsbanden, die vaak op zeven bar of hoger staan. Er zitten adapters bij voor autoventielen, fietsventielen en ballen, wat betekent dat het apparaat ook in het schuurtje nuttig blijft. Het aandachtspunt is de accu: met 2.000 mAh doe je één set autobanden bij, daarna moet hij weer aan de lader. Voor een noodgeval langs de weg is dat genoeg, maar reken er niet op dat je twee auto’s achter elkaar doet. OnderwegShop verzendt dit product.',
      whyItStandsOut:
        'De automatische stop op een ingestelde waarde maakt het verschil tussen gokken bij een tankstation en gewoon weten dat het goed staat.',
      bestFor: ['vakantieritten', 'fietsers', 'wie geen tankstation wil zoeken'],
      caveat: 'De accu is genoeg voor één set autobanden; daarna moet hij eerst opladen.',
      seoTitle: 'Rondweg draagbare autocompressor met autostop',
      metaDescription:
        'Draadloze autocompressor met digitale drukmeter en automatische stop. Actuele prijs bij OnderwegShop, dagelijks gecontroleerd.',
      tags: ['auto', 'onderweg', 'compressor', 'fiets'],
      uniquenessScore: 60,
      storyScore: 52,
      usefulnessScore: 86,
      giftabilityScore: 68,
    },
  },
  {
    externalId: 'OW-7112',
    merchantSlug: 'demo-onderwegshop',
    title: 'Rondweg Stofzuiger compacte autostofzuiger',
    brand: 'Rondweg',
    model: 'RS-8',
    ean: '8712345000172',
    primaryCategory: 'Auto & Onderweg',
    shortSourceDescription:
      'Draadloze autostofzuiger met een zuigkracht van 8.000 pascal, uitwasbaar filter en een smalle kierenzuiger van 20 centimeter.',
    specifications: {
      Zuigkracht: '8.000 Pa',
      Looptijd: '22 minuten',
      Filter: 'uitwasbaar',
      Accessoires: 'kierenzuiger, borstel',
      Gewicht: '640 gram',
    },
    image: 'autostofzuiger',
    imageAlt: 'Illustratie van een kleine draadloze autostofzuiger met smalle zuigmond',
    priceCents: 3900,
    referencePriceCents: 4900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 13,
    collections: ['slimmer-wonen-onder-100'],
    editorial: {
      headline: 'Voor de kruimels tussen de stoelen die niemand bereikt',
      teaser:
        'De rommel in een auto zit precies op de plekken waar een gewone stofzuiger niet komt: tussen de stoel en de console, in de naad van de achterbank. Deze zuiger is 640 gram met een kierenzuiger van twintig centimeter. Het filter kun je uitwassen. Na 22 minuten is de accu leeg, dus doe één auto per keer.',
      longDescription:
        'Een auto wordt niet vies van grote dingen maar van kruimels, zand en hondenharen die zich in naden verstoppen. Deze draadloze zuiger weegt 640 gram, wat betekent dat je hem met één hand gebruikt terwijl je met de andere de bank optilt. De opgegeven zuigkracht van 8.000 pascal is genoeg voor zand en kruimels; grind uit een schoenprofiel vraagt meer. De meegeleverde kierenzuiger van twintig centimeter komt tussen de stoel en de middenconsole, precies de plek waar het meeste blijft liggen, en met de borstel haal je harenuit de stof. Het filter is uitwasbaar, dus je hoeft geen zakjes of vervangfilters te kopen, wat dit soort apparaten normaal onnodig duur in gebruik maakt. Het aandachtspunt is de looptijd: 22 minuten is genoeg voor één auto, maar bij een bus of een tweede auto moet je tussendoor laden. OnderwegShop verkoopt en verzendt dit product; wij controleren alleen de prijs.',
      whyItStandsOut:
        'Een uitwasbaar filter en een echte kierenzuiger maken dit een apparaat waar je jaren mee doet zonder verbruiksartikelen te kopen.',
      bestFor: ['gezinsauto’s', 'hondenbezitters', 'wie zijn auto netjes wil houden'],
      caveat: 'De accu gaat 22 minuten mee: genoeg voor één auto, niet voor twee achter elkaar.',
      seoTitle: 'Rondweg compacte autostofzuiger met uitwasbaar filter',
      metaDescription:
        'Draadloze autostofzuiger met 8.000 Pa, kierenzuiger en uitwasbaar filter. Actuele prijs bij OnderwegShop, dagelijks gecontroleerd.',
      tags: ['auto', 'schoonmaak', 'onderweg', 'gemak'],
      uniquenessScore: 52,
      storyScore: 50,
      usefulnessScore: 84,
      giftabilityScore: 60,
    },
  },
  {
    externalId: 'OW-7124',
    merchantSlug: 'demo-onderwegshop',
    title: 'Koelmaat Trip elektrische koelbox 24 liter',
    brand: 'Koelmaat',
    model: 'KT-24',
    ean: '8712345000189',
    primaryCategory: 'Auto & Onderweg',
    shortSourceDescription:
      'Elektrische koelbox van 24 liter met compressor, instelbaar van min achttien tot plus tien graden, met aansluiting op 12 volt en netstroom.',
    specifications: {
      Inhoud: '24 liter',
      Temperatuur: '-18 tot +10 °C',
      Aansluiting: '12 V en 230 V',
      Geluid: '45 dB',
      Gewicht: '12 kg',
    },
    image: 'koelbox-trip',
    imageAlt: 'Illustratie van een elektrische koelbox met deksel en bedieningspaneel',
    priceCents: 22900,
    referencePriceCents: 29900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 12,
    collections: [],
    editorial: {
      headline: 'Een koelbox die ook echt bevriest',
      teaser:
        'De meeste koelboxen houden koud wat al koud was en geven het na een dag op. Deze heeft een compressor en gaat tot achttien graden onder nul, dus je vervoert er ook ijs en diepvriesproducten in. Werkt op 12 volt in de auto en op netstroom op de camping. Met twaalf kilo til je hem liever niet ver.',
      longDescription:
        'Een gewone koelbox met koelelementen is eigenlijk een geïsoleerde doos die de strijd langzaam verliest. Deze box heeft een echte compressor en houdt volgens de aanbieder een instelbare temperatuur tussen min achttien en plus tien graden, ongeacht hoe warm het in de auto is. Dat betekent dat je op vakantie ook diepvriesproducten en ijs kunt vervoeren, of op de camping een paar dagen vlees kunt bewaren zonder elke ochtend naar de winkel. Hij werkt op 12 volt via de auto-aansluiting en op 230 volt netstroom, dus je hoeft geen tweede oplossing te zoeken als je er bent. Het geluid van 45 decibel is vergelijkbaar met een zachte koelkast, wat in een tent dichterbij voelt dan in een auto. Het aandachtspunt is het gewicht: twaalf kilo leeg, en vol al gauw twintig, dus over een kampeerveld sjouwen is geen pretje. OnderwegShop verzendt de koelbox.',
      whyItStandsOut:
        'Een compressor in dit formaat maakt van een koelbox een kleine vrieskist die je in de auto meeneemt.',
      bestFor: ['kampeervakanties', 'lange autoritten', 'festivals en boottochten'],
      caveat: 'Twaalf kilo leeg en bijna twintig vol; over een kampeerterrein sjouwen valt niet mee.',
      seoTitle: 'Koelmaat Trip elektrische koelbox 24 liter',
      metaDescription:
        'Elektrische koelbox van 24 liter met compressor, -18 tot +10 °C, 12 V en 230 V. Actuele prijs bij OnderwegShop, dagelijks gecontroleerd.',
      tags: ['onderweg', 'kamperen', 'koelbox', 'reizen'],
      uniquenessScore: 64,
      storyScore: 58,
      usefulnessScore: 82,
      giftabilityScore: 48,
    },
  },
  {
    externalId: 'AN-2230',
    merchantSlug: 'demo-atelier-noord',
    title: 'Sterrenwacht Bouwset mechanisch planetarium',
    brand: 'Sterrenwacht',
    model: 'PL-7',
    ean: '8712345000196',
    primaryCategory: 'Speelgoed & Hobby',
    shortSourceDescription:
      'Bouwset van 320 onderdelen voor een mechanisch planetarium met tandwielen die de banen van zeven planeten laten draaien.',
    specifications: {
      Onderdelen: '320',
      Bouwtijd: '4 tot 6 uur',
      Materiaal: 'berkenhout en messing',
      Diameter: '34 cm',
      Aandrijving: 'handmatig met slinger',
    },
    image: 'bouwset-planetarium',
    imageAlt: 'Illustratie van een mechanisch planetarium met tandwielen en planeetbanen',
    priceCents: 7900,
    referencePriceCents: 9900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 5,
    collections: ['slimmer-wonen-onder-100', 'redactiefavorieten'],
    editorial: {
      headline: 'Bouw je eigen zonnestelsel met tandwielen',
      teaser:
        'Een set van 320 houten en messing onderdelen die samen een planetarium worden: draai aan de slinger en zeven planeten lopen hun baan. Het duurt een lange middag om te bouwen en daarna staat er iets van 34 centimeter breed op je kast. De kleine tandwielen vragen wel geduld en een rustige tafel.',
      longDescription:
        'Sommige bouwsets zijn na één keer klaar en verdwijnen in een doos. Dit planetarium blijft juist staan, want als het af is kun je aan een slinger draaien en lopen zeven planeten hun eigen baan om de zon. Het is precies het soort object waar iemand op visite naartoe loopt om er zelf even aan te draaien. Volgens de aanbieder bestaat de set uit 320 onderdelen van berkenhout en messing en kost bouwen vier tot zes uur, dus het is een project voor een regenachtige zaterdag in plaats van een halfuurtje. De diameter van 34 centimeter maakt het groot genoeg om te zien wat er gebeurt zonder dat je een tafel kwijt bent. De aandrijving is handmatig, wat betekent dat er geen batterijen in gaan en dat je zelf bepaalt hoe snel een jaar duurt. Het aandachtspunt is precies dat aantal onderdelen: de tandwielen zijn klein, en met kinderen onder de tien wordt dit vooral een project voor de ouder. Atelier Noord verzendt de set.',
      whyItStandsOut:
        'Het is geen model dat stilstaat maar een mechaniek dat je zelf laat draaien, en dat maakt het na het bouwen nog steeds leuk.',
      bestFor: ['regenachtige middagen', 'cadeaus voor nieuwsgierige types', 'wie graag met zijn handen bouwt'],
      caveat: 'De tandwielen zijn klein: met jonge kinderen wordt dit vooral een project voor de ouder.',
      seoTitle: 'Sterrenwacht mechanisch planetarium bouwset',
      metaDescription:
        'Houten bouwset van 320 delen voor een draaiend mechanisch planetarium. Actuele prijs bij Atelier Noord, dagelijks gecontroleerd.',
      tags: ['hobby', 'bouwset', 'cadeau', 'sterrenkunde'],
      uniquenessScore: 84,
      storyScore: 82,
      usefulnessScore: 54,
      giftabilityScore: 88,
    },
  },
  {
    externalId: 'HV-1020',
    merchantSlug: 'demo-huisvondst',
    title: 'Knikkerlijn Grand houten knikkerbaan',
    brand: 'Knikkerlijn',
    model: 'KG-4',
    ean: '8712345000202',
    primaryCategory: 'Speelgoed & Hobby',
    shortSourceDescription:
      'Uitbreidbare houten knikkerbaan met 96 blokken, drie hellingbanen en een lift die knikkers weer naar boven brengt.',
    specifications: {
      Onderdelen: '96 blokken',
      Hoogte: 'tot 70 cm',
      Materiaal: 'beukenhout',
      Bijzonder: 'mechanische knikkerlift',
      Knikkers: '20 meegeleverd',
    },
    image: 'knikkerbaan-hout',
    imageAlt: 'Illustratie van een houten knikkerbaan met hellingen en een knikkerlift',
    priceCents: 6400,
    referencePriceCents: 8400,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 14,
    collections: ['slimmer-wonen-onder-100'],
    editorial: {
      headline: 'Een knikkerbaan met een lift die hem zelf vult',
      teaser:
        'Het probleem met knikkerbanen is dat iemand de knikkers steeds naar boven moet brengen. Deze set heeft een mechanische lift die dat doet, waardoor de baan blijft lopen. 96 beuken blokken, drie hellingen en twintig knikkers erbij. Een baan van zeventig centimeter hoog vraagt wel een stabiele, vlakke ondergrond.',
      longDescription:
        'Iedere knikkerbaan is tien minuten spannend en daarna een klus, omdat iemand telkens de knikkers van beneden naar boven moet brengen. In deze set zit een mechanische lift die de knikkers zelf omhoog tilt, waardoor de baan blijft rondlopen zolang er iemand aan draait. Dat verandert het spel: in plaats van bouwen en één keer kijken, ga je de route aanpassen om te zien wat er gebeurt. De set bestaat volgens de aanbieder uit 96 blokken beukenhout met drie hellingbanen en twintig knikkers, en de banen zijn tot ongeveer zeventig centimeter hoog te stapelen. Hout is hier prettiger dan plastic omdat de blokken zwaarder zijn en de constructie daardoor beter blijft staan. Het aandachtspunt is die hoogte: op een tapijt of een wiebelende tafel valt een baan van zeventig centimeter makkelijk om, dus je hebt een vlakke, stabiele plek nodig. Huisvondst verkoopt en verzendt de set.',
      whyItStandsOut:
        'De knikkerlift haalt precies de saaie stap uit het spel, waardoor er ook op de tweede middag nog mee gespeeld wordt.',
      bestFor: ['kinderen vanaf vier jaar', 'regenachtige dagen', 'cadeaus die blijven liggen'],
      caveat: 'Een baan van zeventig centimeter hoog valt om op tapijt of een wiebelige tafel.',
      seoTitle: 'Knikkerlijn Grand houten knikkerbaan met lift',
      metaDescription:
        'Houten knikkerbaan van 96 blokken met mechanische knikkerlift en 20 knikkers. Actuele prijs bij Huisvondst, dagelijks gecontroleerd.',
      tags: ['speelgoed', 'hout', 'kinderen', 'cadeau'],
      uniquenessScore: 70,
      storyScore: 68,
      usefulnessScore: 62,
      giftabilityScore: 86,
    },
  },
  {
    externalId: 'HV-1032',
    merchantSlug: 'demo-huisvondst',
    title: 'Mechano Arm robotarm bouwpakket',
    brand: 'Mechano',
    model: 'MA-6',
    ean: '8712345000219',
    primaryCategory: 'Speelgoed & Hobby',
    shortSourceDescription:
      'Bouwpakket voor een robotarm met zes assen, bediening via een kleine joystickconsole en een programmeerbare herhaalfunctie.',
    specifications: {
      Assen: '6',
      Bereik: '32 cm',
      Bediening: 'joystickconsole',
      Programmeerbaar: 'tot 20 stappen',
      Bouwtijd: '3 uur',
    },
    image: 'robotarm-bouwpakket',
    imageAlt: 'Illustratie van een robotarm met zes gewrichten en een grijper',
    priceCents: 8900,
    referencePriceCents: 11500,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 16,
    collections: ['slimmer-wonen-onder-100'],
    editorial: {
      headline: 'Een robotarm die onthoudt wat je hem voordoet',
      teaser:
        'Je bouwt de arm in ongeveer drie uur, bedient hem met een joystick en kunt daarna een reeks van twintig stappen laten herhalen. Daarmee gaat het van speelgoed naar iets dat je zelf programmeert. Bereik is 32 centimeter. De grijper pakt lichte dingen zoals gum en blokjes, maar geen volle kopjes.',
      longDescription:
        'Veel technisch speelgoed is na het bouwen vooral iets om naar te kijken. Deze robotarm heeft zes assen en een console met joysticks, en het aardige zit in de herhaalfunctie: je voert een reeks bewegingen uit, de arm slaat tot twintig stappen op en doet ze daarna zelf opnieuw. Op dat moment leg je uit wat programmeren is zonder dat er een computer aan te pas komt. Volgens de aanbieder kost bouwen ongeveer drie uur, wat een goede zaterdagmiddag is voor een kind met een ouder erbij. Het bereik van 32 centimeter is genoeg om iets van de ene kant van de tafel naar de andere te verplaatsen, precies groot genoeg om indruk te maken. Het aandachtspunt is de kracht van de grijper: die is bedoeld voor lichte voorwerpen zoals blokjes, gum of een dopje, dus verwacht niet dat de arm een volle beker optilt. Huisvondst verkoopt en verzendt dit pakket; wij controleren de prijs.',
      whyItStandsOut:
        'De herhaalfunctie maakt van bouwen ook programmeren, en dat houdt de arm interessant lang nadat hij af is.',
      bestFor: ['kinderen vanaf tien jaar', 'techniekliefhebbers', 'ouders die willen meebouwen'],
      caveat: 'De grijper is voor lichte voorwerpen; een volle beker tilt hij niet op.',
      seoTitle: 'Mechano Arm robotarm bouwpakket met herhaalfunctie',
      metaDescription:
        'Bouwpakket voor een robotarm met zes assen en programmeerbare herhaalfunctie. Actuele prijs bij Huisvondst, dagelijks gecontroleerd.',
      tags: ['hobby', 'techniek', 'bouwpakket', 'cadeau'],
      uniquenessScore: 76,
      storyScore: 72,
      usefulnessScore: 58,
      giftabilityScore: 82,
    },
  },
  {
    externalId: 'GK-8101',
    merchantSlug: 'demo-gemakskamer',
    title: 'Stofveeg Ronde robotstofzuiger met dweilfunctie',
    brand: 'Stofveeg',
    model: 'SV-40',
    ean: '8712345000226',
    primaryCategory: 'Comfort & Gemak',
    shortSourceDescription:
      'Robotstofzuiger met lasernavigatie, dweilfunctie en een stofcontainer in het laadstation die de robot zelf leegt.',
    specifications: {
      Navigatie: 'laser',
      Zuigkracht: '4.000 Pa',
      Dweilfunctie: 'aanwezig',
      Zelflegend: 'station voor 30 dagen',
      Geluid: '62 dB',
    },
    image: 'robotstofzuiger',
    imageAlt: 'Illustratie van een ronde robotstofzuiger naast een laadstation',
    priceCents: 39900,
    referencePriceCents: 52900,
    referencePriceType: 'RECOMMENDED_RETAIL_PRICE',
    inStock: true,
    discoveredDaysAgo: 1,
    collections: ['redactiefavorieten'],
    editorial: {
      headline: 'De robot die zijn eigen stofzak leegt',
      teaser:
        'Een robotstofzuiger die je elke dag moet legen is vooral een extra taak. Deze rijdt terug naar een station dat het stof opzuigt en volgens de aanbieder dertig dagen bewaart. Lasernavigatie betekent dat hij kamers systematisch afwerkt in plaats van willekeurig rond te botsen. Bij het legen maakt hij een paar seconden flink geluid.',
      longDescription:
        'De belofte van een robotstofzuiger sneuvelt meestal op onderhoud: een klein stofbakje dat je dagelijks leeg moet maken, en een robot die willekeurig door de kamer stuitert. Deze versie navigeert met een laser, waardoor hij kamers in banen afwerkt en onthoudt waar hij al is geweest. Het laadstation zuigt na elke ronde het stof uit de robot in een grotere container die volgens de aanbieder dertig dagen meegaat, zodat het onderhoud van dagelijks naar maandelijks verschuift. De dweilfunctie neemt harde vloeren mee in dezelfde ronde; verwacht een frisse vloer, geen schrobbeurt. Met 4.000 pascal pakt hij zand, kruimels en haren op laagpolig tapijt goed op. Het aandachtspunt is geluid bij het legen: op dat moment maakt het station een paar seconden aanzienlijk meer lawaai dan de robot zelf, dus zet de schoonmaakronde niet op een moment dat er iemand slaapt. Gemakskamer verzendt dit product.',
      whyItStandsOut:
        'Het zelflegende station verandert het onderhoud van een dagelijkse taak in iets wat je een keer per maand doet.',
      bestFor: ['huishoudens met huisdieren', 'wie weinig tijd heeft', 'harde vloeren en laagpolig tapijt'],
      caveat: 'Bij het legen maakt het station een paar seconden flink geluid.',
      seoTitle: 'Stofveeg robotstofzuiger met zelflegend station',
      metaDescription:
        'Robotstofzuiger met lasernavigatie, dweilfunctie en zelflegend station. Actuele prijs bij Gemakskamer, dagelijks gecontroleerd.',
      tags: ['comfort', 'schoonmaak', 'robot', 'smart home'],
      uniquenessScore: 66,
      storyScore: 60,
      usefulnessScore: 92,
      giftabilityScore: 56,
    },
  },
  {
    externalId: 'GK-8114',
    merchantSlug: 'demo-gemakskamer',
    title: 'Snoetje Automatische voerdispenser met camera',
    brand: 'Snoetje',
    model: 'SN-5',
    ean: '8712345000233',
    primaryCategory: 'Comfort & Gemak',
    shortSourceDescription:
      'Voerdispenser van vier liter met programmeerbare porties, camera met spraakfunctie en een noodbatterij voor stroomuitval.',
    specifications: {
      Inhoud: '4 liter',
      Porties: 'tot 6 per dag',
      Camera: '1080p met microfoon',
      Noodbatterij: '3x AA',
      App: 'iOS en Android',
    },
    image: 'voerdispenser',
    imageAlt: 'Illustratie van een automatische voerdispenser met voorraadtank en camera',
    priceCents: 9900,
    referencePriceCents: 12900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 15,
    collections: ['slimmer-wonen-onder-100'],
    editorial: {
      headline: 'Je kat voeren terwijl je in de trein zit',
      teaser:
        'Vier liter voorraad, tot zes porties per dag en een camera waardoor je kunt kijken of het inderdaad in de bak beland is. Via de app spreek je een berichtje in, wat vooral voor jezelf prettig is. Er zit een noodbatterij in voor stroomuitval. Katten die graag aan dingen duwen, kunnen hem omgooien.',
      longDescription:
        'Wie een kat heeft en onregelmatige dagen werkt, kent het rekenwerk: is er genoeg voer, en om hoe laat is het op? Deze dispenser houdt vier liter droogvoer in voorraad en geeft volgens de aanbieder tot zes porties per dag op vaste tijden, die je vanaf de app aanpast als je later thuis bent. De camera met microfoon is de reden dat dit ding meer is dan een timer: je ziet of er echt is uitgedeeld en of je kat het opeet, in plaats van er thuis achter te komen dat het mechanisme vastzat. Er zit een noodbatterij op drie AA-cellen in, zodat een korte stroomstoring geen overgeslagen maaltijd betekent. Het aandachtspunt is stabiliteit: een gemotiveerde kat die geleerd heeft dat er voer in zit, kan een lichte dispenser omduwen, dus zet hem tegen een muur of tegen een plint. Gemakskamer verkoopt en verzendt de dispenser.',
      whyItStandsOut:
        'De camera maakt het verschil tussen hopen dat het goed gaat en gewoon zien dat het voer in de bak ligt.',
      bestFor: ['katten en kleine honden', 'onregelmatige werkdagen', 'weekenden weg'],
      caveat: 'Een gemotiveerde kat kan de dispenser omduwen; zet hem tegen een muur.',
      seoTitle: 'Snoetje automatische voerdispenser met camera',
      metaDescription:
        'Voerdispenser van 4 liter met porties, camera, spraakfunctie en noodbatterij. Actuele prijs bij Gemakskamer, dagelijks gecontroleerd.',
      tags: ['comfort', 'huisdieren', 'camera', 'gemak'],
      uniquenessScore: 62,
      storyScore: 64,
      usefulnessScore: 84,
      giftabilityScore: 64,
    },
  },
  {
    externalId: 'GK-8126',
    merchantSlug: 'demo-gemakskamer',
    title: 'Warmvoet Kussen verwarmd voetenkussen voor onder het bureau',
    brand: 'Warmvoet',
    model: 'WV-2',
    ean: '8712345000240',
    primaryCategory: 'Comfort & Gemak',
    shortSourceDescription:
      'Verwarmd voetenkussen met drie standen, uitneembare wasbare hoes en een verbruik van 45 watt.',
    specifications: {
      Standen: '3',
      Vermogen: '45 watt',
      Afmetingen: '45 x 35 cm',
      Hoes: 'wasbaar op 30 graden',
      Uitschakeling: 'na 90 minuten',
    },
    image: 'voetenkussen-warm',
    imageAlt: 'Illustratie van een verwarmd voetenkussen met wasbare hoes',
    priceCents: 3400,
    referencePriceCents: 4500,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    discoveredDaysAgo: 18,
    collections: ['slimmer-wonen-onder-100'],
    editorial: {
      headline: 'Warme voeten voor minder dan een kop koffie per week',
      teaser:
        'Koude voeten zijn de reden dat mensen de verwarming een graad hoger zetten voor het hele huis. Dit kussen verbruikt 45 watt, ongeveer net zoveel als een lamp, en heeft drie standen. De hoes gaat in de wasmachine. Na negentig minuten schakelt het uit, dus je zet het meerdere keren per dag aan.',
      longDescription:
        'Een koud huis voelt vooral koud aan je voeten, en dat is precies waarom veel mensen de thermostaat hoger zetten om één lichaamsdeel te verwarmen. Dit kussen van 45 bij 35 centimeter komt onder je bureau of voor de bank en verbruikt op de hoogste stand 45 watt, vergelijkbaar met een gloeilamp en een fractie van wat centrale verwarming kost. Er zijn drie standen, zodat je op een frisse ochtend hoger begint en later terugschakelt. De hoes is uitneembaar en mag op dertig graden in de wasmachine, wat bij iets waar je met sokken op staat geen overbodige luxe is. Voor de veiligheid schakelt het kussen na negentig minuten automatisch uit, en dat is ook het eerlijke aandachtspunt: op een lange werkdag moet je het een paar keer opnieuw aanzetten. Voor wie thuiswerkt in een koude kamer is dat een kleine prijs voor warme voeten. Gemakskamer verzendt dit product.',
      whyItStandsOut:
        'Het verwarmt de plek waar je de kou daadwerkelijk voelt, voor een fractie van wat een graad hoger op de thermostaat kost.',
      bestFor: ['thuiswerkers', 'koude werkkamers', 'wie snel koude voeten heeft'],
      caveat: 'Het kussen schakelt na negentig minuten uit en moet daarna opnieuw aan.',
      seoTitle: 'Warmvoet verwarmd voetenkussen met wasbare hoes',
      metaDescription:
        'Verwarmd voetenkussen met drie standen, 45 watt en wasbare hoes. Actuele prijs bij Gemakskamer, dagelijks door ons gecontroleerd.',
      tags: ['comfort', 'thuiswerken', 'warmte', 'winter'],
      uniquenessScore: 54,
      storyScore: 56,
      usefulnessScore: 82,
      giftabilityScore: 72,
    },
  },
  {
    externalId: 'HV-1044',
    merchantSlug: 'demo-huisvondst',
    title: 'Nimbus Wolkenlamp met bliksemeffect',
    brand: 'Nimbus',
    model: 'NW-1',
    ean: '8712345000257',
    primaryCategory: 'Onnodig Maar Geweldig',
    shortSourceDescription:
      'Hanglamp in de vorm van een wolk met led die een bliksemeffect kan nabootsen, inclusief geluidsmodus die op muziek reageert.',
    specifications: {
      Breedte: '60 cm',
      Materiaal: 'polyester vezel',
      Modi: 'sfeer, bliksem, geluid',
      Bediening: 'afstandsbediening',
      Voeding: 'netstroom',
    },
    image: 'wolkenlamp',
    imageAlt: 'Illustratie van een hanglamp in wolkvorm met lichtflitsen erin',
    priceCents: 12900,
    referencePriceCents: null,
    referencePriceType: null,
    inStock: true,
    discoveredDaysAgo: 0,
    collections: ['onnodig-maar-geweldig'],
    editorial: {
      headline: 'Een wolk aan je plafond die kan onweren',
      teaser:
        'Zestig centimeter kunstwolk aan je plafond, met led die een onweersbui nabootst en een stand die op muziek reageert. Volstrekt overbodig en precies daarom leuk voor een speelkamer of feest. Wij vonden geen betrouwbare vergelijkingsprijs bij de aanbieder, dus dit product staat hier zonder dealclaim.',
      longDescription:
        'Er zijn producten die een probleem oplossen en producten die vooral een gesprek starten. Deze lamp hoort in de tweede categorie: een wolk van polyestervezel van zestig centimeter breed, met led erin die een onweersbui kan nabootsen. Er zijn drie standen volgens de aanbieder: rustig sfeerlicht, een bliksemstand en een modus die op geluid reageert, waarbij de flitsen meelopen met muziek. In een speelkamer, een tienerkamer of boven een feesttafel is dat een leuk effect; in een woonkamer waar je ook wil lezen wordt het snel te veel. De lamp hangt aan netstroom en wordt met een afstandsbediening bediend. Wij hebben bij deze aanbieder geen betrouwbare vergelijkingsprijs kunnen vaststellen, en daarom laten we bewust geen van-prijs, besparing of kortingspercentage zien. Je ziet alleen de huidige prijs die de aanbieder rekent. Huisvondst verkoopt en verzendt dit product; wij verkopen zelf niets.',
      whyItStandsOut:
        'Een lamp die het weer nadoet, is precies het soort product waarvan je vijf minuten eerder niet wist dat het bestond.',
      bestFor: ['speelkamers', 'feestjes', 'wie iets bijzonders aan het plafond wil'],
      caveat: 'De bliksemstand is te onrustig voor een kamer waarin je ook wil lezen of werken.',
      seoTitle: 'Nimbus wolkenlamp met bliksemeffect',
      metaDescription:
        'Hanglamp in wolkvorm met bliksem- en geluidsmodus, 60 cm breed. Huidige prijs bij Huisvondst, zonder vergelijkingsprijs.',
      tags: ['onnodig maar geweldig', 'verlichting', 'wolk', 'feest'],
      uniquenessScore: 94,
      storyScore: 88,
      usefulnessScore: 34,
      giftabilityScore: 76,
    },
  },
  {
    externalId: 'BH-6140',
    merchantSlug: 'demo-buitenhof',
    title: 'Vlam Tafelvuurkorf op bio-ethanol',
    brand: 'Vlam',
    model: 'VT-3',
    ean: '8712345000264',
    primaryCategory: 'Cadeaus',
    shortSourceDescription:
      'Tafelmodel vuurkorf op bio-ethanol van 22 centimeter hoog met een glazen scherm en een brander die ongeveer een uur brandt.',
    specifications: {
      Hoogte: '22 cm',
      Brandstof: 'bio-ethanol',
      Brandduur: 'ongeveer 60 minuten',
      Materiaal: 'staal en glas',
      Gewicht: '2,4 kg',
    },
    image: 'tafelvuurkorf',
    imageAlt: 'Illustratie van een kleine tafelvuurkorf met glazen scherm en vlam',
    priceCents: 5900,
    referencePriceCents: 7900,
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: false,
    discoveredDaysAgo: 21,
    collections: ['onnodig-maar-geweldig'],
    editorial: {
      headline: 'Een vuurtje midden op tafel, zonder rook',
      teaser:
        'Bio-ethanol brandt zonder rook en zonder vonken, dus dit kleine vuurtje kan gewoon tussen de borden staan. Ongeveer een uur vlam per vulling, achter een glazen scherm. Leuk voor lange avonden buiten en als cadeau. Dit exemplaar is bij de aanbieder momenteel uitverkocht, dus de dealknop staat uit.',
      longDescription:
        'Een vuurkorf is gezellig maar groot, rokerig en niet iets wat je op tafel zet. Deze versie is 22 centimeter hoog, brandt op bio-ethanol en geeft daardoor een vlam zonder rook of vonken, waardoor hij tussen de glazen en borden kan staan. Volgens de aanbieder brandt een vulling ongeveer een uur, precies lang genoeg voor een avond buiten of een langgerekt diner. Het glazen scherm eromheen houdt de vlam stabiel bij een zuchtje wind en zorgt dat niemand er per ongeluk in grijpt. Met 2,4 kilo verplaats je hem eenvoudig van binnen naar buiten. Als cadeau werkt dit goed omdat het klein is, meteen te gebruiken valt en niemand het zelf koopt. Let op de bijzonderheden van bio-ethanol: bijvullen mag alleen als de brander volledig is afgekoeld, en dat vraagt geduld op een avond waarop je hem twee keer wil gebruiken. Buitenhof verkoopt en verzendt dit product zodra het weer op voorraad is.',
      whyItStandsOut:
        'Een echt vuurtje dat je zonder rook of vonken midden op een gedekte tafel kunt zetten, in een formaat dat past naast de borden.',
      bestFor: ['cadeaus', 'lange avonden buiten', 'balkons zonder ruimte voor een vuurkorf'],
      caveat: 'Bijvullen mag alleen als de brander volledig is afgekoeld, en dat kost tijd.',
      seoTitle: 'Vlam tafelvuurkorf op bio-ethanol',
      metaDescription:
        'Tafelmodel vuurkorf op bio-ethanol met glazen scherm, ongeveer 60 minuten brandtijd. Prijsinformatie van Buitenhof, dagelijks gecontroleerd.',
      tags: ['cadeau', 'buiten', 'vuurkorf', 'sfeer'],
      uniquenessScore: 72,
      storyScore: 70,
      usefulnessScore: 56,
      giftabilityScore: 90,
    },
  },
]

/** Snelle lookup van handgeschreven demo-content op titel. */
const editorialByTitle = new Map(demoProducts.map((product) => [product.title, product.editorial]))

export function demoEditorialForTitle(title: string) {
  return editorialByTitle.get(title)
}
