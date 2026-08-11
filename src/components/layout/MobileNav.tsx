'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { categories } from '@/lib/categories'
import { collections } from '@/lib/collections'

const pages = [
  { href: '/nieuw', label: 'Nieuw ontdekt' },
  { href: '/bewaard', label: 'Bewaard' },
  { href: '/hoe-wij-selecteren', label: 'Hoe wij selecteren' },
  { href: '/over', label: 'Over ons' },
]

/**
 * Mobiel menu. Toetsenbordbediening: Escape sluit, focus gaat naar de
 * sluitknop en terug naar de menuknop.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const openButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <button
        ref={openButton}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobiel-menu"
        className="inline-flex size-11 items-center justify-center rounded-pill text-ink transition-colors hover:bg-canvas md:hidden"
      >
        <Menu aria-hidden className="size-5" />
        <span className="sr-only">Menu openen</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink/30"
            onClick={() => setOpen(false)}
            role="presentation"
          />
          <div
            id="mobiel-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-card p-5 shadow-card"
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-bold">Menu</p>
              <button
                ref={closeButton}
                type="button"
                onClick={() => {
                  setOpen(false)
                  openButton.current?.focus()
                }}
                className="inline-flex size-11 items-center justify-center rounded-pill text-ink transition-colors hover:bg-canvas"
              >
                <X aria-hidden className="size-5" />
                <span className="sr-only">Menu sluiten</span>
              </button>
            </div>

            <nav aria-label="Categorieën" className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Categorieën</p>
              <ul className="mt-2 space-y-1" role="list">
                {categories.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/categorie/${category.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center rounded-tile px-3 text-sm font-medium text-ink hover:bg-canvas"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Collecties" className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Collecties</p>
              <ul className="mt-2 space-y-1" role="list">
                {collections.map((collection) => (
                  <li key={collection.slug}>
                    <Link
                      href={`/collectie/${collection.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center rounded-tile px-3 text-sm font-medium text-ink hover:bg-canvas"
                    >
                      {collection.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Overige pagina's" className="mt-6">
              <ul className="space-y-1" role="list">
                {pages.map((page) => (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 items-center rounded-tile px-3 text-sm font-medium text-muted hover:bg-canvas hover:text-ink"
                    >
                      {page.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  )
}
