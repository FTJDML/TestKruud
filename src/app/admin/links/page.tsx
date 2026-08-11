import { redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { refreshLinkSuggestionsAction, reviewLinkSuggestionAction } from '@/app/admin/editorial-actions'

export const dynamic = 'force-dynamic'

/**
 * Interne links. Suggesties worden berekend uit bestaande relaties, maar een link
 * verschijnt pas op de site na goedkeuring: de linkstructuur blijft een
 * redactionele keuze.
 */
const typeLabels: Record<string, string> = {
  CLUSTER: 'thema',
  CATEGORY: 'categorie',
  COLLECTION: 'collectie',
  EDITORIAL_PAGE: 'gids',
  PRODUCT: 'product',
}

export default async function AdminInternalLinks() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const [suggested, approved, rejected] = await Promise.all([
    prisma.internalLinkSuggestion.findMany({
      where: { status: 'SUGGESTED' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.internalLinkSuggestion.count({ where: { status: 'APPROVED' } }),
    prisma.internalLinkSuggestion.count({ where: { status: 'REJECTED' } }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Interne links</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            {suggested.length} suggesties open · {approved} goedgekeurd · {rejected} afgewezen. Een afgewezen
            suggestie komt niet elke dag terug.
          </p>
        </div>
        <form action={refreshLinkSuggestionsAction}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
          >
            Suggesties verversen
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Van</th>
              <th className="px-4 py-3">Naar</th>
              <th className="px-4 py-3">Anchor</th>
              <th className="px-4 py-3">Reden</th>
              <th className="px-4 py-3">Beoordelen</th>
            </tr>
          </thead>
          <tbody>
            {suggested.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-muted">
                  Geen open suggesties.
                </td>
              </tr>
            ) : (
              suggested.map((suggestion) => (
                <tr key={suggestion.id} className="border-b border-line/70 align-top last:border-0">
                  <td className="px-4 py-3 text-xs">
                    {typeLabels[suggestion.fromType] ?? suggestion.fromType}
                    <br />
                    {suggestion.fromRef}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {typeLabels[suggestion.toType] ?? suggestion.toType}
                    <br />
                    {suggestion.toRef}
                  </td>
                  <td className="px-4 py-3">{suggestion.anchorText}</td>
                  <td className="px-4 py-3 text-xs text-muted">{suggestion.reason}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <form action={reviewLinkSuggestionAction}>
                        <input type="hidden" name="suggestionId" value={suggestion.id} />
                        <input type="hidden" name="status" value="APPROVED" />
                        <button
                          type="submit"
                          className="inline-flex min-h-11 items-center rounded-pill border border-line px-3 text-xs font-semibold hover:border-ink"
                        >
                          Goedkeuren
                        </button>
                      </form>
                      <form action={reviewLinkSuggestionAction}>
                        <input type="hidden" name="suggestionId" value={suggestion.id} />
                        <input type="hidden" name="status" value="REJECTED" />
                        <button
                          type="submit"
                          className="inline-flex min-h-11 items-center rounded-pill border border-line px-3 text-xs font-semibold text-muted hover:border-accent hover:text-accent"
                        >
                          Afwijzen
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
