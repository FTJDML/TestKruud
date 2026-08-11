/**
 * Testfixtures voor saves en kliks. Deze data komt nooit in een productie- of
 * demo-seed: publiek zichtbare aantallen mogen niet worden gefabriceerd.
 */
export const testVisitorIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
] as const

export const testClickSources = ['home-vandaag', 'product-detail', 'zoeken'] as const
