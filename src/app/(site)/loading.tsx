import { Container } from '@/components/ui/Container'
import { ProductGridSkeleton, Skeleton } from '@/components/ui/Skeleton'

/** Loading state met dezelfde afmetingen als de echte inhoud. */
export default function Loading() {
  return (
    <Container className="pt-8">
      <Skeleton className="h-64 w-full sm:h-80" />
      <Skeleton className="mt-10 h-8 w-56" />
      <div className="mt-6">
        <ProductGridSkeleton count={4} />
      </div>
    </Container>
  )
}
