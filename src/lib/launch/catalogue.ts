/**
 * De launchcatalogus: hoeveel zichtbare producten wij per cluster willen hebben
 * voordat de site af is.
 *
 * Dit zijn **doelen, geen vulopdracht**. Er wordt nooit een product verzonnen om
 * een getal te halen; het rapport laat gewoon zien wat er nog mist. Zo is te
 * zien of een cluster klaar is voor publicatie en welke bron nog nodig is.
 */
export type LaunchTarget = {
  clusterSlug: string
  label: string
  products: number
}

export const launchTargets: readonly LaunchTarget[] = [
  { clusterSlug: 'koffie-en-slimme-keuken', label: 'Koffie & Slimme Keuken', products: 30 },
  { clusterSlug: 'smart-home-en-schoonmaak', label: 'Smart Home & Schoonmaak', products: 30 },
  { clusterSlug: 'gaming-en-entertainment-thuis', label: 'Gaming & Entertainment', products: 25 },
  { clusterSlug: 'tuin-en-buitenleven', label: 'Tuin & Buitenleven', products: 25 },
  { clusterSlug: 'wonen-design-en-meubels', label: 'Wonen & Design', products: 20 },
  { clusterSlug: 'speelgoed-hobby-en-cadeaus', label: 'Speelgoed, Hobby & Cadeaus', products: 20 },
]

/** Totaal aantal zichtbare producten dat de launch beoogt. */
export const launchProductTarget = launchTargets.reduce((total, entry) => total + entry.products, 0)

/**
 * Categorieregels voor de catalogusimport: een zoekwoord uit de categorie of de
 * titel van de bron, en de categorie van deze site waar het thuishoort.
 *
 * De regels zijn bewust met de hand geschreven en niet gegenereerd: alleen wat
 * werkelijk bij "bijzondere producten voor thuis" past komt binnen, de rest
 * wordt overgeslagen. De eerste regel die past, wint, dus specifieke regels
 * staan boven algemene.
 */
export const launchCategoryRules: readonly { match: string; category: string }[] = [
  // Koffie en keuken
  { match: 'koffiemolen', category: 'Keuken & Apparaten' },
  { match: 'coffee grinder', category: 'Keuken & Apparaten' },
  { match: 'espresso', category: 'Keuken & Apparaten' },
  { match: 'koffiezetapparaat', category: 'Keuken & Apparaten' },
  { match: 'coffee maker', category: 'Keuken & Apparaten' },
  { match: 'waterkoker', category: 'Keuken & Apparaten' },
  { match: 'oven', category: 'Keuken & Apparaten' },
  { match: 'airfryer', category: 'Keuken & Apparaten' },
  { match: 'blender', category: 'Keuken & Apparaten' },
  { match: 'keukenmachine', category: 'Keuken & Apparaten' },
  { match: 'ijsmachine', category: 'Keuken & Apparaten' },
  { match: 'sodamaker', category: 'Keuken & Apparaten' },
  { match: 'grill', category: 'Keuken & Apparaten' },
  { match: 'kitchen', category: 'Keuken & Apparaten' },

  // Smart home en schoonmaak
  { match: 'robotstofzuiger', category: 'Comfort & Gemak' },
  { match: 'robot vacuum', category: 'Comfort & Gemak' },
  { match: 'stofzuiger', category: 'Comfort & Gemak' },
  { match: 'vacuum cleaner', category: 'Comfort & Gemak' },
  { match: 'luchtreiniger', category: 'Comfort & Gemak' },
  { match: 'air purifier', category: 'Comfort & Gemak' },
  { match: 'luchtvochtiger', category: 'Comfort & Gemak' },
  { match: 'ventilator', category: 'Comfort & Gemak' },
  { match: 'raamwisser', category: 'Comfort & Gemak' },
  { match: 'deurbel', category: 'Smart Home & Tech' },
  { match: 'doorbell', category: 'Smart Home & Tech' },
  { match: 'slimme lamp', category: 'Smart Home & Tech' },
  { match: 'smart light', category: 'Smart Home & Tech' },
  { match: 'smart plug', category: 'Smart Home & Tech' },
  { match: 'thermostaat', category: 'Smart Home & Tech' },
  { match: 'bewakingscamera', category: 'Smart Home & Tech' },
  { match: 'security camera', category: 'Smart Home & Tech' },
  { match: 'smart speaker', category: 'Smart Home & Tech' },
  { match: 'sensor', category: 'Smart Home & Tech' },

  // Gaming en entertainment
  { match: 'projector', category: 'Gaming & Entertainment' },
  { match: 'beamer', category: 'Gaming & Entertainment' },
  { match: 'gamingstoel', category: 'Gaming & Entertainment' },
  { match: 'gaming chair', category: 'Gaming & Entertainment' },
  { match: 'arcade', category: 'Gaming & Entertainment' },
  { match: 'soundbar', category: 'Gaming & Entertainment' },
  { match: 'koptelefoon', category: 'Gaming & Entertainment' },
  { match: 'headset', category: 'Gaming & Entertainment' },
  { match: 'platenspeler', category: 'Gaming & Entertainment' },
  { match: 'turntable', category: 'Gaming & Entertainment' },

  // Tuin en buitenleven
  { match: 'robotmaaier', category: 'Tuin & Buitenleven' },
  { match: 'robotic lawnmower', category: 'Tuin & Buitenleven' },
  { match: 'grasmaaier', category: 'Tuin & Buitenleven' },
  { match: 'barbecue', category: 'Tuin & Buitenleven' },
  { match: 'pizzaoven', category: 'Tuin & Buitenleven' },
  { match: 'hogedrukreiniger', category: 'Tuin & Buitenleven' },
  { match: 'terrasverwarmer', category: 'Tuin & Buitenleven' },
  { match: 'zwembad', category: 'Tuin & Buitenleven' },
  { match: 'tuinverlichting', category: 'Tuin & Buitenleven' },
  { match: 'buitenlamp', category: 'Tuin & Buitenleven' },
  { match: 'garden', category: 'Tuin & Buitenleven' },

  // Wonen en design
  { match: 'fauteuil', category: 'Wonen & Design' },
  { match: 'bankset', category: 'Wonen & Design' },
  { match: 'loungeset', category: 'Wonen & Design' },
  { match: 'sofa', category: 'Wonen & Design' },
  { match: 'bijzettafel', category: 'Wonen & Design' },
  { match: 'eettafel', category: 'Wonen & Design' },
  { match: 'bureaulamp', category: 'Wonen & Design' },
  { match: 'vloerlamp', category: 'Wonen & Design' },
  { match: 'hanglamp', category: 'Wonen & Design' },
  { match: 'spiegel', category: 'Wonen & Design' },
  { match: 'kast', category: 'Wonen & Design' },
  { match: 'bureau', category: 'Wonen & Design' },
  { match: 'stoel', category: 'Wonen & Design' },

  // Speelgoed, hobby en cadeaus
  { match: 'bouwset', category: 'Speelgoed & Hobby' },
  { match: 'building set', category: 'Speelgoed & Hobby' },
  { match: 'knikkerbaan', category: 'Speelgoed & Hobby' },
  { match: 'modelbouw', category: 'Speelgoed & Hobby' },
  { match: 'puzzel', category: 'Speelgoed & Hobby' },
  { match: 'bordspel', category: 'Speelgoed & Hobby' },
  { match: 'robotarm', category: 'Speelgoed & Hobby' },
  { match: 'telescoop', category: 'Speelgoed & Hobby' },
  { match: 'microscoop', category: 'Speelgoed & Hobby' },
  { match: 'speelgoed', category: 'Speelgoed & Hobby' },
  { match: 'toy', category: 'Speelgoed & Hobby' },

  // Onderweg
  { match: 'koelbox', category: 'Auto & Onderweg' },
  { match: 'compressor', category: 'Auto & Onderweg' },
  { match: 'powerstation', category: 'Auto & Onderweg' },
  { match: 'accessoire voor de auto', category: 'Auto & Onderweg' },
]
