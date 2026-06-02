'use server';

import { redirect } from 'next/navigation';
import { loginRequest } from '@/lib/api';
import { createSession, deleteSession } from '@/lib/session';

export interface LoginFormState {
  error?: string;
}

/**
 * Login Server Action (useActionState ile kullanılır).
 * Başarılıysa oturumu cookie'ye yazar ve /dashboard'a yönlendirir.
 * Hatalıysa formda gösterilecek mesajı döndürür.
 */
export async function login(
  _prevState: LoginFormState | undefined,
  formData: FormData,
): Promise<LoginFormState> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { error: 'Kullanıcı adı ve şifre zorunludur.' };
  }

  const result = await loginRequest(username, password);

  if (!result.ok) {
    return { error: result.error };
  }

  await createSession({ token: result.token, user: result.user });

  // redirect() özel bir hata fırlatır; try/catch ile sarmalanmamalı.
  redirect('/dashboard');
}

/** Çıkış: oturumu siler ve giriş ekranına döner. */
export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/login');
}
