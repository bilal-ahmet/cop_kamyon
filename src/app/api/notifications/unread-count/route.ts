import { NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/lib/session';

const BACKEND_URL = process.env.BACKEND_URL;

/**
 * Zil rozeti için okunmamış bildirim sayısı (istemci tarafı polling).
 * Cookie'deki token'ı okuyup backend'e Bearer ile gider; token istemciye düşmez.
 *
 * 502, istemci için ayrıca anlam taşır: backend'e ulaşılamıyorsa kullanıcının kendi
 * bağlantısı da kopmuş olabilir — OfflineBanner bu sinyali kullanır.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Oturum yok' }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/notifications/unread-count`, {
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
  if (!res.ok) {
    return NextResponse.json({ error: 'Backend hatası' }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ count: Number(data?.count) || 0 }, { status: 200 });
}
