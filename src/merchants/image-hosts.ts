/**
 * Centrale lijst met remote image hosts die `next/image` mag optimaliseren.
 * Voeg hier het CDN-domein van een nieuwe merchant toe (zie README).
 * Deze module heeft geen imports zodat `next.config.ts` haar veilig kan lezen.
 */
export const merchantImageHosts: readonly string[] = [
  // Voorbeeld voor echte merchants; fictieve demo-content gebruikt lokale afbeeldingen.
  'images.homeandlivingdeals.nl',
  // Publieke bron van de open-source democatalogus (zie src/merchants/sources).
  'raw.githubusercontent.com',
]

export const merchantImageRemotePatterns = merchantImageHosts.map((hostname) => ({
  protocol: 'https' as const,
  hostname,
}))
