import type { ReactNode } from 'react'
import { Breadcrumbs } from '@/components/product/Breadcrumbs'
import { Container } from '@/components/ui/Container'
import { JsonLd } from '@/components/seo/JsonLd'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'

type Props = {
  title: string
  intro: string
  path: string
  children: ReactNode
}

/** Eenvoudige, leesbare opmaak voor de informatiepagina's. */
export function TextPage({ title, intro, path, children }: Props) {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: title, path },
  ]
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Container className="pt-6">
        <Breadcrumbs items={crumbs} />
        <header className="mt-4 max-w-3xl">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">{intro}</p>
        </header>
      </Container>
      <Container className="pt-8">
        <div className="max-w-3xl space-y-6 rounded-card border border-line bg-card p-6 text-[15px] leading-relaxed text-ink/90 sm:p-8 [&_a]:underline [&_a:hover]:text-accent [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted [&_ul]:space-y-1.5">
          {children}
        </div>
      </Container>
    </>
  )
}
