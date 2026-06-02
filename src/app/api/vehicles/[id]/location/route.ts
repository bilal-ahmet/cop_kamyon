import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, deleteSession } from '@/lib/session';
import { normalizeLocation } from '@/lib/normalize';

const BACKEND_URL = process.env.BACKEND_URL;

/**
 * İstemci tarafı polling için konum uç noktası.
 * Cookie'deki token'ı okuyup backend'e Bearer ile gider; token istemciye düşmez.
 * - Oturum yok / 401 → 401 (istemci login'e yönlendirir)
 * - Backend 404 (henüz konum yok) → 200 ve gövde null
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Oturum yok' }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/vehicles/${id}/location`, {
      headers: { Authorization: `Bearer ${session.token}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Backend ulaşılamadı' }, { status: 502 });
  }

  if (res.status === 401) {
    await deleteSession();
    return NextResponse.json({ error: 'Token geçersiz' }, { status: 401 });
  }
  if (res.status === 403) {
    return NextResponse.json({ error: 'Yetki yok' }, { status: 403 });
  }
  if (res.status === 404) {
    // Henüz telemetri yok.
    return NextResponse.json(null, { status: 200 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: 'Backend hatası' }, { status: 502 });
  }

  const raw = await res.json();
  return NextResponse.json(normalizeLocation(raw), { status: 200 });
}
