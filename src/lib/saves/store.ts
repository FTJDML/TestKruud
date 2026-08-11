/**
 * Externe store voor bewaarde producten, gelezen met `useSyncExternalStore`.
 * localStorage geeft directe feedback, de database is de bron van waarheid.
 */
const STORAGE_KEY = 'hald.saves.v1'

export type SavesSnapshot = {
  ids: ReadonlySet<string>
  /** True zodra de synchronisatie met de database is afgerond. */
  ready: boolean
}

const emptySnapshot: SavesSnapshot = { ids: new Set(), ready: false }
let snapshot: SavesSnapshot = emptySnapshot
let hydrationStarted = false

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function setSnapshot(next: SavesSnapshot): void {
  snapshot = next
  emit()
}

function readLocal(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

function writeLocal(ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Private modus zonder localStorage: de database blijft leidend.
  }
}

async function hydrate(): Promise<void> {
  setSnapshot({ ids: new Set(readLocal()), ready: false })
  try {
    const response = await fetch('/api/saves', { headers: { accept: 'application/json' } })
    const data: unknown = response.ok ? await response.json() : null
    const ids =
      data && typeof data === 'object' && Array.isArray((data as { productIds?: unknown }).productIds)
        ? (data as { productIds: unknown[] }).productIds.filter(
            (entry): entry is string => typeof entry === 'string',
          )
        : [...snapshot.ids]
    const next = new Set(ids)
    writeLocal(next)
    setSnapshot({ ids: next, ready: true })
  } catch {
    // Offline: we werken door met de lokale status.
    setSnapshot({ ids: snapshot.ids, ready: true })
  }
}

export function subscribeSaves(listener: () => void): () => void {
  listeners.add(listener)
  if (!hydrationStarted) {
    hydrationStarted = true
    void hydrate()
  }
  return () => {
    listeners.delete(listener)
  }
}

export function getSavesSnapshot(): SavesSnapshot {
  return snapshot
}

export function getServerSavesSnapshot(): SavesSnapshot {
  return emptySnapshot
}

export type ToggleResult = 'saved' | 'unsaved' | 'error'

/** Optimistic toggle; draait terug wanneer de server het verzoek afwijst. */
export async function toggleSave(productId: string): Promise<ToggleResult> {
  const previous = snapshot.ids
  const wasSaved = previous.has(productId)
  const optimistic = new Set(previous)
  if (wasSaved) optimistic.delete(productId)
  else optimistic.add(productId)

  writeLocal(optimistic)
  setSnapshot({ ids: optimistic, ready: snapshot.ready })

  try {
    const response = await fetch('/api/saves', {
      method: wasSaved ? 'DELETE' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId }),
    })
    if (!response.ok) throw new Error(`status ${response.status}`)
    return wasSaved ? 'unsaved' : 'saved'
  } catch {
    writeLocal(previous)
    setSnapshot({ ids: previous, ready: snapshot.ready })
    return 'error'
  }
}
