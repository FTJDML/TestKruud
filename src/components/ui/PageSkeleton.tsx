import { Container } from '@/components/ui/Container'
import { ProductGridSkeleton, Skeleton } from '@/components/ui/Skeleton'

/**
 * Laadstatus met dezelfde afmetingen als de echte inhoud, zodat er geen layout
 * shift ontstaat.
 *
 * Bewust niet op route-groepniveau: een `loading.tsx` maakt een Suspense-grens,
 * waardoor de eerste bytes al zijn verzonden voordat een pagina `notFound()`
 * kan aanroepen. Die pagina zou dan een 200 met "niet gevonden" tonen in plaats
 * van een echte 404. Daarom staat dit alleen bij routes die nooit 404 geven.
 */
export function PageSkeleton({ hero = false, count = 8 }: { hero?: boolean; count?: number }) {
  return (
    <Container className="pt-8">
      {hero ? <Skeleton className="h-64 w-full sm:h-80" /> : null}
      <Skeleton className={hero ? 'mt-10 h-8 w-56' : 'h-8 w-56'} />
      <div className="mt-6">
        <ProductGridSkeleton count={count} />
      </div>
    </Container>
  )
}
