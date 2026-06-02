import { redirect } from 'next/navigation';

// Kök adres: dashboard'a yönlendir. Giriş yoksa proxy login'e geri atar.
export default function Home() {
  redirect('/dashboard');
}
