'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/analytics/client'

const milestones = [25, 50, 75, 100] as const

/** Meldt scroll-depth één keer per mijlpaal per pagina. */
export function ScrollDepthTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const reached = new Set<number>()
    function onScroll() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (scrollable <= 0) return
      const percentage = Math.round((window.scrollY / scrollable) * 100)
      for (const milestone of milestones) {
        if (percentage >= milestone && !reached.has(milestone)) {
          reached.add(milestone)
          trackEvent({ type: 'scroll_depth', path: pathname, percentage: milestone })
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  return null
}
