/**
 * Lichte taalcontrole. De site is Nederlands; brondata is dat vaak niet.
 * Zonder deze controle belandt een Engelse leverancierszin midden in een
 * Nederlandse alinea. Bewust een woordenlijst en geen dependency: de vraag is
 * alleen "is dit Nederlands of Engels", niet welke taal het precies is.
 */
const dutchMarkers = new Set([
  'aan',
  'als',
  'bij',
  'dan',
  'dat',
  'de',
  'deze',
  'dit',
  'door',
  'dus',
  'een',
  'en',
  'geen',
  'het',
  'hoe',
  'je',
  'maar',
  'meer',
  'met',
  'naar',
  'niet',
  'nog',
  'ook',
  'om',
  'tot',
  'uit',
  'van',
  'voor',
  'want',
  'waar',
  'wel',
  'wordt',
  'zijn',
  'zo',
])

const englishMarkers = new Set([
  'about',
  'also',
  'and',
  'any',
  'are',
  'been',
  'for',
  'from',
  'has',
  'have',
  'into',
  'its',
  'more',
  'only',
  'other',
  'our',
  'such',
  'than',
  'that',
  'the',
  'their',
  'they',
  'this',
  'very',
  'when',
  'which',
  'while',
  'will',
  'with',
  'you',
  'your',
])

export type LanguageScore = { dutch: number; english: number; words: number }

export function scoreLanguage(text: string): LanguageScore {
  const words = text.toLowerCase().match(/[a-zà-ÿ']+/g) ?? []
  let dutch = 0
  let english = 0
  for (const word of words) {
    if (dutchMarkers.has(word)) dutch += 1
    else if (englishMarkers.has(word)) english += 1
  }
  return { dutch, english, words: words.length }
}

/**
 * Ziet deze tekst uit als Nederlands? Korte fragmenten krijgen het voordeel van
 * de twijfel; een langere tekst zonder één Nederlands functiewoord niet.
 */
export function looksDutch(text: string): boolean {
  const { dutch, english, words } = scoreLanguage(text)
  if (words < 4) return true
  if (words >= 8 && dutch === 0) return false
  if (dutch === 0 && english === 0) return true
  return dutch >= english
}
