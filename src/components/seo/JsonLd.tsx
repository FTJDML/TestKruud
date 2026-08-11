import type { JsonLdObject } from '@/lib/seo/jsonld'

/**
 * Rendert structured data. De inhoud komt uit onze eigen modules, nooit uit
 * gebruikersinvoer, en moet exact overeenkomen met de zichtbare informatie.
 */
export function JsonLd({
  data,
}: {
  /** `null` mag: een pagina zonder claim krijgt gewoon geen markup. */
  data: JsonLdObject | null | Array<JsonLdObject | null>
}) {
  const payload = (Array.isArray(data) ? data : [data]).filter(
    (entry): entry is JsonLdObject => entry !== null,
  )
  return (
    <>
      {payload.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry).replace(/</g, '\\u003c') }}
        />
      ))}
    </>
  )
}
