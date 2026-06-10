import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { fetchNearbyPois } from '@/lib/overpass';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ctx.params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Oturum yok' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lon = parseFloat(searchParams.get('lon') ?? '');
  const radius = parseInt(searchParams.get('radius') ?? '500', 10);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'lat ve lon gerekli' }, { status: 400 });
  }

  try {
    const pois = await fetchNearbyPois(lat, lon, radius);
    return NextResponse.json(pois, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json({ error: 'POI verisi alınamadı' }, { status: 502 });
  }
}
