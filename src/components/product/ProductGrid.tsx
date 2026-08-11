import { ProductCard } from '@/components/product/ProductCard'
import { cn } from '@/lib/utils'
import type { ProductCardView } from '@/types'

type Props = {
  products: readonly ProductCardView[]
  surface: string
  /** Aantal kaarten dat direct (priority) mag laden. */
  priorityCount?: number
  className?: string
}

/**
 * Productraster: vier kaarten op brede schermen, drie op kleinere desktops,
 * twee op tablet en één op mobiel.
 */
export function ProductGrid({ products, surface, priorityCount = 0, className }: Props) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4',
        className,
      )}
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          surface={surface}
          position={index}
          priority={index < priorityCount}
        />
      ))}
    </div>
  )
}
