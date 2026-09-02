'use server';

import { revalidatePath } from 'next/cache';
import { apiMutate } from '@/lib/api';
import type { AppNotification } from '@/lib/types';
import { type ActionState } from './_shared';

/** Bildirim değişikliği hem listeyi hem başlıktaki zil rozetini etkiler. */
function revalidateNotifications() {
  revalidatePath('/dashboard/bildirimler');
  revalidatePath('/dashboard');
}

/** Tek bildirimi okundu işaretler (PUT /notifications/:id/read). */
export async function markNotificationRead(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Geçersiz bildirim.' };

  const res = await apiMutate<AppNotification>(`/notifications/${id}/read`, 'PUT');
  if (!res.ok) return { error: res.error };

  revalidateNotifications();
  return { ok: true };
}

/**
 * Okunmamış tüm bildirimleri okundu işaretler (PUT /notifications/read-all).
 * Parametre almaz; useActionState'in geçtiği (prev, formData) argümanları yok sayılır
 * (daha az parametreli fonksiyon, daha çok parametreli imzaya atanabilir).
 */
export async function markAllNotificationsRead(): Promise<ActionState> {
  const res = await apiMutate<{ updated: number }>('/notifications/read-all', 'PUT');
  if (!res.ok) return { error: res.error };

  revalidateNotifications();
  return { ok: true };
}

/** Bildirimi kalıcı olarak siler (DELETE /notifications/:id). */
export async function deleteNotification(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Geçersiz bildirim.' };

  const res = await apiMutate(`/notifications/${id}`, 'DELETE');
  if (!res.ok) return { error: res.error };

  revalidateNotifications();
  return { ok: true };
}
