'use client'

import { useActionState } from 'react'
import { loginAction, type ActionState } from '@/app/admin/actions'

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, null)

  return (
    <div className="mx-auto max-w-md rounded-card border border-line bg-card p-6">
      <h1 className="font-display text-2xl font-extrabold">Inloggen</h1>
      <p className="mt-2 text-sm text-muted">
        Gebruik de gegevens uit ADMIN_USERNAME en ADMIN_PASSWORD. De sessie staat in een httpOnly cookie.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium">
            Gebruikersnaam
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            className="mt-1 h-11 w-full rounded-tile border border-line px-3 text-sm focus:border-ink focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Wachtwoord
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 h-11 w-full rounded-tile border border-line px-3 text-sm focus:border-ink focus:outline-none"
          />
        </div>

        {state && !state.ok ? (
          <p role="alert" className="rounded-tile bg-accent-soft px-3 py-2 text-sm text-accent">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-60"
        >
          {pending ? 'Bezig…' : 'Inloggen'}
        </button>
      </form>
    </div>
  )
}
