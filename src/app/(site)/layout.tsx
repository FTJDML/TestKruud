import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SkipLink } from '@/components/layout/SkipLink'
import { StagingBanner } from '@/components/layout/StagingBanner'
import { SavesProvider } from '@/components/product/SavesProvider'
import { ScrollDepthTracker } from '@/components/editorial/ScrollDepthTracker'
import { JsonLd } from '@/components/seo/JsonLd'
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/jsonld'

/**
 * Publieke layout: sticky header met zoekbalk en categoriebalk, hoofdinhoud en
 * footer. Adminroutes gebruiken deze layout bewust niet.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SavesProvider>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <SkipLink />
      <StagingBanner />
      <SiteHeader />
      <main id="hoofdinhoud" className="pb-6">
        {children}
      </main>
      <SiteFooter />
      <ScrollDepthTracker />
    </SavesProvider>
  )
}
