import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Liveness: draait het proces nog? Bewust zonder database en zonder enige
 * inhoudelijke of gevoelige informatie, zodat Docker en een uptimecheck hier
 * veilig op kunnen pollen. Voor "is de app klaar om verkeer te krijgen" is er
 * /api/ready.
 */
export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } })
}
