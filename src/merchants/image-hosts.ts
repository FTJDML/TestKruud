/**
 * Hosts waarvan `next/image` afbeeldingen mag optimaliseren.
 *
 * Drie lagen, in deze volgorde:
 *
 * 1. deze lijst — hosts die bij de applicatie zelf horen;
 * 2. `NEXT_IMAGE_EXTRA_HOSTS` — komma-gescheiden env-variabele, zodat een
 *    merchant-CDN op de server kan worden toegevoegd zonder codewijziging;
 * 3. `Merchant.imageHosts` in de database — per merchant vastgelegd, gebruikt
 *    door de image-validator en zichtbaar in `/admin/integraties`.
 *
 * Laag 1 en 2 worden door `next.config.ts` gelezen en zijn dus buildtijd of
 * starttijd bekend; laag 3 is documentatie en validatie tijdens de import.
 * Deze module heeft geen imports zodat `next.config.ts` haar veilig kan lezen.
 */
export const merchantImageHosts: readonly string[] = [
  // Voorbeeld voor echte merchants; fictieve demo-content gebruikt lokale afbeeldingen.
  'images.homeandlivingdeals.nl',
  // Publieke bron van de open democatalogus (zie src/merchants/sources).
  'raw.githubusercontent.com',
]

/** Extra hosts uit de environment; leeg wanneer de variabele niet is gezet. */
export function extraImageHostsFromEnv(value = process.env.NEXT_IMAGE_EXTRA_HOSTS): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0 && !host.includes('/') && !host.includes(' '))
}

export function allowedImageHosts(): string[] {
  return [...new Set([...merchantImageHosts, ...extraImageHostsFromEnv()])]
}

export const merchantImageRemotePatterns = allowedImageHosts().map((hostname) => ({
  protocol: 'https' as const,
  hostname,
}))
