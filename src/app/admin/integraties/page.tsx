import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { credentialsAvailable } from '@/lib/scraping/authenticated-http'
import { affiliateConfigSchema } from '@/lib/affiliate/types'
import { linkBuilderFor, scaffoldOnlyNetworks } from '@/lib/affiliate/networks'
import { feedAuthSchema, findLiteralSecrets } from '@/merchants/schemas/feed-config'
import { affiliateLinksEnabled } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Integratieoverzicht. Laat per merchant zien of een koppeling werkt, zonder
 * ooit een secret te tonen: bij credentials staat alleen ja of nee, en bij een
 * netwerk alleen wát er ontbreekt (de naam van een environment variable).
 */
function label(value: boolean, yes = 'ja', no = 'nee'): string {
  return value ? yes : no
}

export default async function AdminIntegrations() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const merchants = await prisma.merchant.findMany({
    orderBy: [{ enabled: 'desc' }, { slug: 'asc' }],
    include: {
      scrapeRuns: { orderBy: { startedAt: 'desc' }, take: 1 },
      _count: { select: { offers: true } },
    },
  })

  const rows = merchants.map((merchant) => {
    const configuration = (merchant.configuration ?? {}) as Record<string, unknown>
    const auth = feedAuthSchema.safeParse(configuration.auth ?? { type: 'none' })
    const affiliate = affiliateConfigSchema.safeParse({
      network: merchant.affiliateNetwork,
      ...(typeof configuration.affiliate === 'object' && configuration.affiliate !== null
        ? configuration.affiliate
        : {}),
    })
    const builder = linkBuilderFor(merchant.affiliateNetwork)
    const missing = affiliate.success ? builder.missingConfiguration(affiliate.data) : ['configuratie ongeldig']
    const lastRun = merchant.scrapeRuns[0] ?? null

    return {
      merchant,
      credentials: auth.success ? credentialsAvailable(auth.data) : false,
      authType: auth.success ? auth.data.type : 'onbekend',
      networkConfigured: missing.length === 0,
      missing,
      isScaffold: scaffoldOnlyNetworks.includes(merchant.affiliateNetwork),
      lastRun,
      offerCount: merchant._count.offers,
      literalSecrets: findLiteralSecrets(configuration),
      // "Feed getest" is geen aanname: er moet een geslaagde run zijn.
      feedTested: Boolean(lastRun && lastRun.status !== 'FAILED' && lastRun.productsFound > 0),
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Integraties</h1>
        <p className="mt-1 text-sm text-muted">
          Per merchant: netwerk, status en of de credentials aanwezig zijn. Waarden van secrets staan hier
          nooit; alleen de namen van environment variables.
        </p>
        <p className="mt-2 text-sm text-muted">
          Affiliate-links staan {affiliateLinksEnabled() ? 'aan' : 'uit'} (AFFILIATE_LINKS_ENABLED). Netwerken
          met de aanduiding <strong>scaffold</strong> zijn nog niet tegen een echt account getest en bouwen
          zonder credentials geen link.
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Netwerk</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Laatst gesynchroniseerd</th>
              <th className="px-4 py-3">Producten</th>
              <th className="px-4 py-3">Credentials</th>
              <th className="px-4 py-3">Feed/API getest</th>
              <th className="px-4 py-3">Laatste fout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.merchant.id} className="border-b border-line/70 last:border-0 align-top">
                <td className="px-4 py-3">
                  <Link href={`/admin/merchants`} className="font-medium text-ink hover:text-accent">
                    {row.merchant.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {row.merchant.slug} · {row.merchant.sourceType}
                    {row.merchant.enabled ? '' : ' · uitgeschakeld'}
                  </p>
                  {row.literalSecrets.length > 0 ? (
                    <p className="mt-1 text-xs font-medium text-accent">
                      Let op: configuratie bevat een letterlijke waarde bij {row.literalSecrets[0]?.path}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {row.merchant.affiliateNetwork}
                  {row.isScaffold ? <span className="block text-xs text-muted">scaffold</span> : null}
                </td>
                <td className="px-4 py-3">
                  {row.networkConfigured ? (
                    <span className="text-deal">geconfigureerd</span>
                  ) : (
                    <span className="text-muted">niet geconfigureerd</span>
                  )}
                  {row.missing.length > 0 ? (
                    <p className="mt-1 text-xs text-muted">ontbreekt: {row.missing.join(', ')}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">
                  {row.lastRun
                    ? `${row.lastRun.startedAt.toISOString().slice(0, 16).replace('T', ' ')} · ${row.lastRun.status}`
                    : 'nog nooit'}
                </td>
                <td className="px-4 py-3 tabular-nums">{row.offerCount}</td>
                <td className="px-4 py-3">
                  {row.authType === 'none' ? (
                    <span className="text-muted">niet nodig</span>
                  ) : (
                    <span className={row.credentials ? 'text-deal' : 'text-accent'}>
                      {label(row.credentials)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{label(row.feedTested)}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {row.lastRun?.errorMessage ? row.lastRun.errorMessage.slice(0, 160) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-card border border-line bg-canvas p-5 text-sm text-muted">
        <h2 className="text-sm font-semibold text-ink">Wat een nieuw netwerk nodig heeft</h2>
        <ul className="mt-2 space-y-1" role="list">
          {scaffoldOnlyNetworks.map((network) => {
            const builder = linkBuilderFor(network)
            return (
              <li key={network}>
                <strong className="text-ink">{builder.label}</strong>: {builder.requires.join(', ')}
              </li>
            )
          })}
        </ul>
        <p className="mt-3">
          Zet de sleutels in de environment en verwijs er in <code>Merchant.configuration</code> alleen bij naam
          naar (bijvoorbeeld <code>apiKeyEnv: &quot;AWIN_API_KEY&quot;</code>).
        </p>
      </section>
    </div>
  )
}
