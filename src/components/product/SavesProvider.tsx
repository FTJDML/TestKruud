'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { trackEvent } from '@/lib/analytics/client'
import {
  getSavesSnapshot,
  getServerSavesSnapshot,
  subscribeSaves,
  toggleSave,
} from '@/lib/saves/store'

type SavesContextValue = {
  savedIds: ReadonlySet<string>
  ready: boolean
  isSaved: (productId: string) => boolean
  toggle: (productId: string) => Promise<void>
}

const SavesContext = createContext<SavesContextValue | null>(null)

/**
 * Stelt de bewaarstatus beschikbaar aan alle hartjes op de pagina en meldt
 * wijzigingen toegankelijk via een aria-live regio.
 */
export function SavesProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeSaves, getSavesSnapshot, getServerSavesSnapshot)
  const [message, setMessage] = useState('')

  const toggle = useCallback(async (productId: string) => {
    const wasSaved = getSavesSnapshot().ids.has(productId)
    trackEvent({ type: wasSaved ? 'unsave' : 'save', productId })
    const result = await toggleSave(productId)
    setMessage(
      result === 'error'
        ? 'Bewaren lukte niet, probeer het later opnieuw'
        : result === 'saved'
          ? 'Bewaard'
          : 'Verwijderd uit bewaard',
    )
  }, [])

  const value = useMemo<SavesContextValue>(
    () => ({
      savedIds: snapshot.ids,
      ready: snapshot.ready,
      isSaved: (productId: string) => snapshot.ids.has(productId),
      toggle,
    }),
    [snapshot, toggle],
  )

  return (
    <SavesContext.Provider value={value}>
      {children}
      <p aria-live="polite" role="status" className="sr-only">
        {message}
      </p>
    </SavesContext.Provider>
  )
}

export function useSaves(): SavesContextValue {
  const context = useContext(SavesContext)
  if (!context) {
    throw new Error('useSaves moet binnen SavesProvider worden gebruikt')
  }
  return context
}
