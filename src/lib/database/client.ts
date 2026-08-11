import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { serverEnv } from '@/lib/env'

/**
 * Prisma 7 verbindt via een driveradapter. In development houden we één client
 * op `globalThis` zodat hot reload geen nieuwe pool per compile opent.
 */
function createClient(): PrismaClient {
  const connectionString = serverEnv().DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL ontbreekt. Kopieer .env.example naar .env.')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
