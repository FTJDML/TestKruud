import type { SourceType } from '@prisma/client'

/**
 * Fictieve demo-aanbieders. Ze bestaan alleen om de interface en de UI te
 * kunnen bouwen; er wordt niets gescraped en er lopen geen echte links.
 */
export type DemoMerchant = {
  slug: string
  name: string
  domain: string
  sourceType: SourceType
  trustScore: number
}

export const demoMerchants: readonly DemoMerchant[] = [
  { slug: 'demo-huisvondst', name: 'Huisvondst (demo)', domain: 'demo.huisvondst.example', sourceType: 'FIXTURE', trustScore: 70 },
  { slug: 'demo-kookkamer', name: 'Kookkamer (demo)', domain: 'demo.kookkamer.example', sourceType: 'FIXTURE', trustScore: 68 },
  { slug: 'demo-slimwonen', name: 'SlimWonen (demo)', domain: 'demo.slimwonen.example', sourceType: 'FIXTURE', trustScore: 66 },
  { slug: 'demo-spelhoek', name: 'Spelhoek (demo)', domain: 'demo.spelhoek.example', sourceType: 'FIXTURE', trustScore: 64 },
  { slug: 'demo-buitenhof', name: 'Buitenhof (demo)', domain: 'demo.buitenhof.example', sourceType: 'FIXTURE', trustScore: 65 },
  { slug: 'demo-onderwegshop', name: 'OnderwegShop (demo)', domain: 'demo.onderwegshop.example', sourceType: 'FIXTURE', trustScore: 62 },
  { slug: 'demo-atelier-noord', name: 'Atelier Noord (demo)', domain: 'demo.ateliernoord.example', sourceType: 'FIXTURE', trustScore: 67 },
  { slug: 'demo-gemakskamer', name: 'Gemakskamer (demo)', domain: 'demo.gemakskamer.example', sourceType: 'FIXTURE', trustScore: 63 },
]

const bySlug = new Map(demoMerchants.map((merchant) => [merchant.slug, merchant]))

export function demoMerchantBySlug(slug: string): DemoMerchant | undefined {
  return bySlug.get(slug)
}
