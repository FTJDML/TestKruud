import type { EditorialFaq } from '@/types'

/**
 * Veelgestelde vragen. De vragen komen uit de pagina zelf: er wordt niets
 * beantwoord wat niet elders op de pagina staat, en er komt geen FAQPage in de
 * structured data zonder dat de vragen ook zichtbaar zijn.
 */
export function FaqBlock({ faqs }: { faqs: readonly EditorialFaq[] }) {
  if (faqs.length === 0) return null
  return (
    <section aria-labelledby="veelgestelde-vragen" className="space-y-3">
      <h2 id="veelgestelde-vragen" className="text-xl font-semibold sm:text-2xl">
        Veelgestelde vragen
      </h2>
      <dl className="divide-y divide-line rounded-card border border-line bg-card">
        {faqs.map((faq) => (
          <div key={faq.question} className="p-4">
            <dt className="font-medium text-ink">{faq.question}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{faq.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
