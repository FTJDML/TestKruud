'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/database/client'
import { checkCredentials, clearAdminCookie, readAdminSession, setAdminCookie } from '@/lib/admin/auth'
import { generateMissingContent } from '@/jobs/lib/content'
import { ingestMerchant } from '@/jobs/lib/ingest'
import { publishDailyEdition } from '@/jobs/lib/publish-edition'
import { runDailyPipeline } from '@/jobs/lib/daily-pipeline'
import { editionDate } from '@/lib/deals/edition-date'
import { errorMessage } from '@/lib/logger'

async function requireSession(): Promise<void> {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')
}

export type ActionState = { ok: boolean; message: string } | null

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')
  if (!checkCredentials(username, password)) {
    return { ok: false, message: 'Onjuiste inloggegevens of adminconfiguratie ontbreekt.' }
  }
  await setAdminCookie(username)
  redirect('/admin')
}

export async function logoutAction(): Promise<void> {
  await clearAdminCookie()
  redirect('/admin/login')
}

const statusSchema = z.enum(['CANDIDATE', 'DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'])

export async function setProductStatusAction(formData: FormData): Promise<void> {
  await requireSession()
  const productId = String(formData.get('productId') ?? '')
  const status = statusSchema.parse(String(formData.get('status') ?? ''))
  await prisma.product.update({
    where: { id: productId },
    data: {
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
    },
  })
  revalidatePath('/admin/producten')
  revalidatePath(`/admin/producten/${productId}`)
  revalidatePath('/')
}

const editorialSchema = z.object({
  headline: z.string().min(5).max(120),
  teaser: z.string().min(40),
  longDescription: z.string().min(80),
  whyItStandsOut: z.string().min(20),
  caveat: z.string().min(10),
  seoTitle: z.string().min(5).max(70),
  metaDescription: z.string().min(20).max(170),
  bestFor: z.string().min(2),
  tags: z.string().min(2),
})

/** Redactionele tekst handmatig aanpassen; markeert de content als beoordeeld. */
export async function updateEditorialAction(formData: FormData): Promise<void> {
  await requireSession()
  const productId = String(formData.get('productId') ?? '')
  const parsed = editorialSchema.parse({
    headline: formData.get('headline'),
    teaser: formData.get('teaser'),
    longDescription: formData.get('longDescription'),
    whyItStandsOut: formData.get('whyItStandsOut'),
    caveat: formData.get('caveat'),
    seoTitle: formData.get('seoTitle'),
    metaDescription: formData.get('metaDescription'),
    bestFor: formData.get('bestFor'),
    tags: formData.get('tags'),
  })

  const splitList = (value: string) =>
    value
      .split(/[\n;]|,\s/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)

  await prisma.editorialContent.update({
    where: { productId },
    data: {
      headline: parsed.headline,
      teaser: parsed.teaser,
      longDescription: parsed.longDescription,
      whyItStandsOut: parsed.whyItStandsOut,
      caveat: parsed.caveat,
      seoTitle: parsed.seoTitle,
      metaDescription: parsed.metaDescription,
      bestFor: splitList(parsed.bestFor),
      tags: splitList(parsed.tags),
      aiProvider: 'redactie',
      reviewedAt: new Date(),
    },
  })
  revalidatePath(`/admin/producten/${productId}`)
  revalidatePath('/')
}

/** AI-content opnieuw genereren voor één product. */
export async function regenerateContentAction(formData: FormData): Promise<void> {
  await requireSession()
  const productId = String(formData.get('productId') ?? '')
  // Hash wissen forceert hergeneratie in de contentstap.
  await prisma.editorialContent.updateMany({ where: { productId }, data: { sourceFactsHash: null } })
  await generateMissingContent(prisma, { limit: undefined, force: false })
  revalidatePath(`/admin/producten/${productId}`)
}

/** Product als hero van de editie van vandaag instellen. */
export async function setHeroAction(formData: FormData): Promise<void> {
  await requireSession()
  const productId = String(formData.get('productId') ?? '')
  const date = editionDate()

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { offers: { orderBy: { currentPrice: 'asc' }, take: 1 } },
  })
  const offer = product?.offers[0]
  if (!product || !offer) return

  const edition = await prisma.dailyEdition.upsert({
    where: { editionDate: date },
    create: { editionDate: date, status: 'PUBLISHED', publishedAt: new Date() },
    update: {},
    select: { id: true },
  })

  await prisma.$transaction(async (tx) => {
    // De vorige hero wordt een gewoon item in de sectie van vandaag.
    await tx.dailyEditionItem.updateMany({
      where: { dailyEditionId: edition.id, section: 'HERO' },
      data: { section: 'TODAY', position: 90 },
    })
    await tx.dailyEditionItem.deleteMany({ where: { dailyEditionId: edition.id, productId } })
    await tx.dailyEditionItem.create({
      data: {
        dailyEditionId: edition.id,
        productId,
        offerId: offer.id,
        position: 0,
        section: 'HERO',
        score: 100,
      },
    })
  })

  revalidatePath('/')
  revalidatePath('/admin')
}

export async function toggleMerchantAction(formData: FormData): Promise<void> {
  await requireSession()
  const merchantId = String(formData.get('merchantId') ?? '')
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { enabled: true } })
  if (!merchant) return
  await prisma.merchant.update({ where: { id: merchantId }, data: { enabled: !merchant.enabled } })
  revalidatePath('/admin/merchants')
  revalidatePath('/')
}

/** Handmatig één merchantbron uitlezen. */
export async function runScrapeAction(formData: FormData): Promise<void> {
  await requireSession()
  const merchantId = String(formData.get('merchantId') ?? '')
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } })
  if (!merchant) return
  await ingestMerchant(prisma, merchant)
  revalidatePath('/admin/runs')
  revalidatePath('/admin/merchants')
}

/** Dagelijkse job handmatig starten. */
export async function runDailyJobAction(): Promise<void> {
  await requireSession()
  try {
    await runDailyPipeline(prisma)
  } catch (error) {
    // De pipeline logt zelf; de admin blijft bruikbaar.
    console.error('Handmatige dagelijkse job mislukt:', errorMessage(error))
  }
  revalidatePath('/admin')
  revalidatePath('/')
}

/** Alleen de editie opnieuw samenstellen, zonder nieuwe ingest. */
export async function republishEditionAction(): Promise<void> {
  await requireSession()
  await publishDailyEdition(prisma)
  revalidatePath('/admin')
  revalidatePath('/')
}
