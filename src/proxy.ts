import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// İyimser (optimistic) rota koruması: yalnızca cookie'nin VARLIĞINA bakar.
// Gerçek doğrulama, veri çekilirken backend'in JWT'yi denetlemesiyle olur.
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get('session')?.value);

  const isProtected = pathname.startsWith('/dashboard');
  const isLogin = pathname === '/login';

  // Giriş yapılmamışsa korumalı rotalardan login'e gönder.
  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  // Zaten girişliyse login sayfasından dashboard'a gönder.
  if (isLogin && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
  }

  return NextResponse.next();
}

// Statik dosyalar ve _next dışındaki tüm rotalarda çalışır.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
