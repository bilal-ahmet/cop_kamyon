import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, deleteSession } from '@/lib/session';

const BACKEND_URL = process.env.BACKEND_URL;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Oturum yok' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const query = new URLSearchParams();
  for (const key of ['from', 'to', 'limit', 'fix_valid']) {
    const v = searchParams.get(key);
    if (v !== null) query.set(key, v);
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/vehicles/${id}/telemetry?${query}`, {
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
  if (!res.ok) {
    return NextResponse.json({ error: 'Backend hatası' }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: 200 });
}
