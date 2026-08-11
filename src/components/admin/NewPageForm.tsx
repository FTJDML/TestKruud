'use client'

import { useActionState } from 'react'
import { createEditorialPageAction, type EditorialActionState } from '@/app/admin/editorial-actions'
import { archetypes, editorialPageTypes } from '@/lib/editorial/archetypes'

/**
 * Nieuwe redactionele pagina. De overlapcontrole loopt in de serveractie: een
 * pagina die te sterk lijkt op bestaande content wordt niet aangemaakt, met een
 * voorstel om samen te voegen of een canonical te zetten.
 */
export function NewPageForm({ clusters }: { clusters: ReadonlyArray<{ id: string; title: string }> }) {
  const [state, action, pending] = useActionState<EditorialActionState, FormData>(
    createEditorialPageAction,
    null,
  )

  return (
    <form action={action} className="space-y-4 rounded-card border border-line bg-card p-5">
      <h2 className="font-display text-lg font-extrabold">Nieuwe pagina</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-ink">Archetype</span>
          <select
            name="type"
            defaultValue="COMPARISON"
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          >
            {editorialPageTypes.map((type) => (
              <option key={type} value={type}>
                {archetypes[type].label}: minimaal {archetypes[type].minProducts} producten
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Cluster</span>
          <select
            name="clusterId"
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          >
            <option value="">geen cluster</option>
            {clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>
                {cluster.title}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-ink">Titel</span>
          <input
            name="title"
            required
            minLength={10}
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
            placeholder="Koffiemolens voor thuis vergeleken"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-ink">Zoekvraag van de bezoeker (primaryQuery)</span>
          <input
            name="primaryQuery"
            required
            minLength={8}
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
            placeholder="welke koffiemolen past bij mijn espressomachine"
          />
          <span className="mt-1 block text-xs text-muted">
            Eén echte vraag. Maak geen aparte pagina per zoekvariant.
          </span>
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Doelgroep</span>
          <input
            name="audience"
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          />
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Situatie of use case</span>
          <input
            name="useCase"
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          />
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Budget van (€)</span>
          <input
            name="budgetMin"
            inputMode="decimal"
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          />
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Budget tot (€)</span>
          <input
            name="budgetMax"
            inputMode="decimal"
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          />
        </label>
      </div>

      {state ? (
        <p className={state.ok ? 'text-sm text-deal' : 'text-sm text-accent'}>{state.message}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-60"
      >
        {pending ? 'Bezig…' : 'Concept aanmaken'}
      </button>
    </form>
  )
}
