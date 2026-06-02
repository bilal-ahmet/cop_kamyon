import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Çöp Kamyonu Takip</h1>
        <p className="mb-6 text-sm text-zinc-500">Devam etmek için giriş yapın.</p>
        <LoginForm />
      </div>
    </div>
  );
}
