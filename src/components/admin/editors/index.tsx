import type { EditorialPageType } from '@prisma/client'
import { archetypeFor } from '@/lib/editorial/archetypes'
import { labelsForType } from '@/lib/editorial/featured'

/**
 * Editors per archetype.
 *
 * Elk archetype heeft eigen eisen en dus een eigen editor: een budgetgids vraagt
 * een prijsgrens, een probleempagina vraagt een probleemstelling, en een
 * designcollectie krijgt bewust geen "beste"-labels. Deze componenten leveren de
 * archetype-specifieke velden en de hulptekst; de gedeelde velden (titel, SEO,
 * producten, criteria, bronnen) staan in de pagina zelf.
 */
export type EditorProps = {
  type: EditorialPageType
  page: {
    audience: string | null
    useCase: string | null
    budgetMinCents: number | null
    budgetMaxCents: number | null
    featuredLabel: string | null
  }
}

function euros(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')
}

function Field({
  label,
  name,
  defaultValue,
  hint,
  placeholder,
}: {
  label: string
  name: string
  defaultValue?: string
  hint?: string
  placeholder?: string
}) {
  return (
    <label className="text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
      />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

function Purpose({ type }: { type: EditorialPageType }) {
  const archetype = archetypeFor(type)
  return (
    <div className="rounded-tile border border-line bg-canvas p-3 text-xs text-muted">
      <p className="font-medium text-ink">{archetype.label}</p>
      <p className="mt-1">{archetype.purpose}</p>
      <p className="mt-1">
        Minimaal {archetype.minProducts} producten (advies {archetype.preferredProducts.min}–
        {archetype.preferredProducts.max})
        {archetype.minCriteria > 0 ? ` · minimaal ${archetype.minCriteria} criteria` : ' · geen criteria vereist'}
        {archetype.requiresMethodology ? ' · methodologie verplicht' : ''}
        {archetype.requiresBudget ? ' · budgetgrens verplicht' : ''}
        {archetype.allowsBestClaim ? '' : ' · geen objectieve "beste"-claim'}
      </p>
    </div>
  )
}

function BudgetFields({ page }: EditorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Budget van (€)"
        name="budgetMin"
        defaultValue={euros(page.budgetMinCents)}
        hint="Leeg laten wanneer er alleen een bovengrens is."
      />
      <Field
        label="Budget tot (€)"
        name="budgetMax"
        defaultValue={euros(page.budgetMaxCents)}
        hint="Verplicht: producten erboven vragen per product een uitleg."
      />
    </div>
  )
}

function AudienceFields({ page, useCaseLabel, useCaseHint }: EditorProps & {
  useCaseLabel?: string
  useCaseHint?: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Doelgroep" name="audience" defaultValue={page.audience ?? ''} />
      <Field
        label={useCaseLabel ?? 'Situatie of use case'}
        name="useCase"
        defaultValue={page.useCase ?? ''}
        {...(useCaseHint ? { hint: useCaseHint } : {})}
      />
    </div>
  )
}

/** Labels die bij dit archetype gekozen mogen worden. */
export function FeaturedLabelSelect({ type, current }: { type: EditorialPageType; current: string | null }) {
  const options = labelsForType(type)
  return (
    <label className="text-sm">
      <span className="font-medium text-ink">Label voor de uitgelichte keuze</span>
      <select
        name="featuredLabel"
        defaultValue={current ?? ''}
        className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
      >
        <option value="">geen label</option>
        {options.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-muted">
        {archetypeFor(type).allowsBestClaim
          ? '"Beste overall" mag alleen wanneer de methodologie die claim onderbouwt.'
          : 'Bij dit archetype spreken wij geen objectieve winnaar uit.'}
      </span>
    </label>
  )
}

export function ComparisonEditor(props: EditorProps) {
  return (
    <div className="space-y-3">
      <Purpose type={props.type} />
      <AudienceFields {...props} useCaseHint="Waar wordt dit product vooral voor gebruikt?" />
      <p className="text-xs text-muted">
        Vul per product elk criterium. Wat de bron niet levert, laat je leeg: de tabel toont dan &quot;Niet
        opgegeven&quot;. Vul nooit een waarde in die je niet in een bron hebt gezien.
      </p>
    </div>
  )
}

export function BestOfEditor(props: EditorProps) {
  return (
    <div className="space-y-3">
      <Purpose type={props.type} />
      <AudienceFields {...props} />
      <p className="text-xs text-muted">
        Geef elk product een eigen doelgroep. Zonder doelgroep is een selectie een willekeurige lijst.
      </p>
    </div>
  )
}

export function BudgetGuideEditor(props: EditorProps) {
  return (
    <div className="space-y-3">
      <Purpose type={props.type} />
      <BudgetFields {...props} />
      <AudienceFields {...props} />
      <p className="text-xs text-muted">
        Leg in de introductie uit wat er binnen dit budget wél en niet haalbaar is. Een product boven de grens
        mag alleen mee met de markering en een uitleg bij dat product.
      </p>
    </div>
  )
}

export function UseCaseGuideEditor(props: EditorProps) {
  return (
    <div className="space-y-3">
      <Purpose type={props.type} />
      <AudienceFields {...props} useCaseLabel="De situatie" useCaseHint="Beschrijf één concrete situatie." />
    </div>
  )
}

export function GiftGuideEditor(props: EditorProps) {
  return (
    <div className="space-y-3">
      <Purpose type={props.type} />
      <BudgetFields {...props} />
      <AudienceFields {...props} useCaseLabel="Gelegenheid" />
      <p className="text-xs text-muted">
        Gebruik de leeftijdsindicatie van de fabrikant als criterium; verzin er zelf geen. Noem welke
        accessoires nog nodig zijn en of het cadeau direct speelbaar is. Veiligheidsinformatie alleen wanneer
        een bron die geeft.
      </p>
    </div>
  )
}

export function DesignCollectionEditor(props: EditorProps) {
  return (
    <div className="space-y-3">
      <Purpose type={props.type} />
      <AudienceFields {...props} useCaseLabel="Ruimte of stijl" />
      <p className="text-xs text-muted">
        Vergelijk stijl, materiaal, afmetingen, zitplaatsen, montage, onderhoud en ruimtegebruik. Spreek geen
        winnaar uit: smaak is geen meetbaar criterium.
      </p>
    </div>
  )
}

export function DealCollectionEditor(props: EditorProps) {
  return (
    <div className="space-y-3">
      <Purpose type={props.type} />
      <AudienceFields {...props} useCaseLabel="Thema" />
      <p className="text-xs text-muted">
        Prijsuitspraken komen uit onze eigen metingen en staan op de productpagina. Zet geen bedragen of
        percentages in de tekst: die zijn morgen verouderd.
      </p>
    </div>
  )
}

export function ProblemSolutionEditor(props: EditorProps) {
  return (
    <div className="space-y-3">
      <Purpose type={props.type} />
      <AudienceFields
        {...props}
        useCaseLabel="Het probleem"
        useCaseHint="Bijvoorbeeld: kattenharen in een tapijt, of een gamekamer in de woonkamer."
      />
      <p className="text-xs text-muted">
        Benoem per product welke eigenschap het voor dit probleem geschikt maakt, en waar die eigenschap uit
        blijkt.
      </p>
    </div>
  )
}

export function DiscoveryCollectionEditor(props: EditorProps) {
  return (
    <div className="space-y-3">
      <Purpose type={props.type} />
      <AudienceFields {...props} useCaseLabel="Toepassing" />
      <p className="text-xs text-muted">
        Korte hook per product, plus een aandachtspunt. Geen technische vergelijking: hier valt niets te meten.
      </p>
    </div>
  )
}

const editors: Record<EditorialPageType, (props: EditorProps) => React.ReactNode> = {
  COMPARISON: ComparisonEditor,
  BEST_OF: BestOfEditor,
  BUDGET_GUIDE: BudgetGuideEditor,
  USE_CASE_GUIDE: UseCaseGuideEditor,
  GIFT_GUIDE: GiftGuideEditor,
  DESIGN_COLLECTION: DesignCollectionEditor,
  DEAL_COLLECTION: DealCollectionEditor,
  PROBLEM_SOLUTION: ProblemSolutionEditor,
  DISCOVERY_COLLECTION: DiscoveryCollectionEditor,
}

export function ArchetypeEditor(props: EditorProps) {
  const Editor = editors[props.type]
  return <Editor {...props} />
}
