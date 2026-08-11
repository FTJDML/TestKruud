# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# HomeAndLivingDeals.nl — productie-image
#
# Vier stages:
#   deps    node_modules + gegenereerde Prisma-client
#   builder `next build` met standalone output
#   runner   het draaiende webproces (standaard target)
#   jobs     tsx-omgeving voor migraties, seed en de worker
#
# De build heeft geen database nodig: alle databasegestuurde pagina's worden per
# request gerenderd.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# --- Dependencies ----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma
# postinstall draait `prisma generate`; daarvoor is het schema al gekopieerd.
RUN pnpm install --frozen-lockfile

# --- Build -----------------------------------------------------------------
FROM base AS builder
ENV NEXT_OUTPUT_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Runtime (web) ---------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Liveness: /api/health raakt de database niet en lekt geen gegevens.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

# --- Jobs (migraties, seed, worker) ---------------------------------------
# Bewust met devDependencies: prisma-cli en tsx horen bij deze taken. Dit image
# serveert geen verkeer en staat in Compose niet aan een poort.
FROM base AS jobs
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs worker
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=worker:nodejs package.json pnpm-lock.yaml prisma.config.ts tsconfig.json ./
COPY --chown=worker:nodejs prisma ./prisma
COPY --chown=worker:nodejs src ./src
USER worker
CMD ["pnpm", "job:worker"]
