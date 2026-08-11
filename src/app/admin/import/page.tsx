import { redirect } from 'next/navigation'
import { readAdminSession } from '@/lib/admin/auth'
import { editorialBriefTemplate, EDITORIAL_BRIEF_COLUMNS } from '@/lib/csv/editorial-brief'
import { productImportTemplate, PRODUCT_IMPORT_COLUMNS } from '@/lib/csv/product-import'
import { ImportForms } from '@/components/admin/ImportForms'

export const dynamic = 'force-dynamic'

/**
 * Batchimport. Twee bestanden, twee doelen:
 *
 * - producten worden aangemaakt als `CANDIDATE` met een nog te controleren
 *   afbeelding;
 * - briefs worden concepten (`DRAFT`), of `SCHEDULED` met een datum.
 *
 * Geen van beide publiceert iets. Er worden ook geen gegevens verzonnen: een rij
 * zonder prijs, afbeelding of URL wordt geweigerd met een reden.
 */
export default async function AdminImport() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Batchimport</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Plak een CSV of neem eerst het sjabloon over. Een import publiceert nooit: producten komen op
          CANDIDATE, briefs worden concepten of ingeplande pagina&apos;s.
        </p>
      </div>

      <ImportForms
        briefTemplate={editorialBriefTemplate()}
        productTemplate={productImportTemplate()}
        briefColumns={[...EDITORIAL_BRIEF_COLUMNS]}
        productColumns={[...PRODUCT_IMPORT_COLUMNS]}
      />
    </div>
  )
}
