import type { JsonLdObject } from '@/lib/seo/jsonld'

/**
 * Rendert structured data. De inhoud komt uit onze eigen modules, nooit uit
 * gebruikersinvoer, en moet exact overeenkomen met de zichtbare informatie.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const payload = Array.isArray(data) ? data : [data]
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
