import 'server-only';

import { cookies } from 'next/headers';
import type { Session } from './types';

// Oturumu sakladığımız httpOnly cookie'nin adı.
const COOKIE_NAME = 'session';

// Backend JWT'si 24 saat geçerli; cookie ömrünü de buna eşitliyoruz.
const MAX_AGE_SECONDS = 60 * 60 * 24;

/**
 * Cookie'deki oturumu okur. Cookie yoksa veya bozuksa null döner.
 * Sadece sunucu tarafında (Server Component / Server Action) çağrılır.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

/** Login başarılı olduğunda oturumu httpOnly cookie olarak yazar. */
export async function createSession(session: Session): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    // localhost (http) için secure kapalı olmalı, yoksa cookie set edilmez.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });
}

/** Çıkışta veya geçersiz token durumunda oturum cookie'sini siler. */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
