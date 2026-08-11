import Link from 'next/link'
import { Container } from '@/components/ui/Container'

export default function NotFound() {
  return (
    <Container className="py-20">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-display text-sm font-bold uppercase tracking-wide text-accent">404</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Deze pagina bestaat niet</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Misschien is het product gearchiveerd of is de link verouderd. Onze vondsten van vandaag staan wel klaar.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-pill bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Naar de homepage
          </Link>
          <Link
            href="/categorieen"
            className="inline-flex min-h-11 items-center rounded-pill border border-line px-5 text-sm font-semibold hover:border-ink"
          >
            Alle categorieën
          </Link>
        </div>
      </div>
    </Container>
  )
}
