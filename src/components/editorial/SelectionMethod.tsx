import type { EditorialSourcesView } from '@/types'

const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * "Hoe deze selectie is gemaakt". Een rustige sectie met alleen wat wij
 * werkelijk kunnen aantonen: de criteria, het aantal vergeleken producten, de
 * datum van de laatste controle, de gebruikte brontypen en of wij het product
 * zelf hebben getest.
 *
 * `handsOnTested` is nooit een aanname: het is waar zodra er een bron van het
 * type OWN_HANDS_ON_TEST bij de pagina staat, en anders staat er expliciet dat
 * wij niet zelf hebben getest.
 */
export function SelectionMethod({
  sources,
  methodology,
}: {
  sources: EditorialSourcesView
  methodology?: string | null
}) {
  return (
    <section
      aria-labelledby="selectie-methode"
      className="rounded-card border border-line bg-canvas p-5 text-sm text-muted"
    >
      <h2 id="selectie-methode" className="text-base font-semibold text-ink">
        Hoe deze selectie is gemaakt
      </h2>

      {methodology ? <p className="mt-2 whitespace-pre-line">{methodology}</p> : null}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {sources.selectionCriteria ? (
          <div className="sm:col-span-2">
            <dt className="font-medium text-ink">Selectiecriteria</dt>
            <dd className="mt-1 whitespace-pre-line">{sources.selectionCriteria}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium text-ink">Vergeleken producten</dt>
          <dd className="mt-1 tabular-nums">{sources.comparedProductCount}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Laatste controle</dt>
          <dd className="mt-1">
            {sources.lastFactCheckedAt ? dateFormat.format(sources.lastFactCheckedAt) : 'nog niet vastgelegd'}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Gebruikte bronnen</dt>
          <dd className="mt-1">
            {sources.sourceTypeLabels.length > 0 ? sources.sourceTypeLabels.join(', ') : 'nog niet vastgelegd'}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink">Zelf getest</dt>
          <dd className="mt-1">
            {sources.handsOnTested
              ? 'ja, met een vastgelegde eigen test'
              : 'nee. Wij vergelijken op gecontroleerde brondata en onze eigen prijsmetingen'}
          </dd>
        </div>
      </dl>

      {sources.sources.length > 0 ? (
        <ul className="mt-4 space-y-1" role="list">
          {sources.sources.map((source) => (
            <li key={`${source.title}-${source.accessedAt.toISOString()}`}>
              {source.url ? (
                <a
                  href={source.url}
                  rel="nofollow noopener"
                  target="_blank"
                  className="underline decoration-line underline-offset-2 hover:text-accent"
                >
                  {source.title}
                </a>
              ) : (
                source.title
              )}
              {source.publisher ? `, ${source.publisher}` : ''} · bekeken op{' '}
              {dateFormat.format(source.accessedAt)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
