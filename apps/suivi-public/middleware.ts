import { NextRequest, NextResponse } from 'next/server';
import { LOCALES, isLocale } from './lib/i18n';

const PUBLIC_FILE = /\.(.*)$/;

function detectLocale(req: NextRequest): string {
  const header = req.headers.get('accept-language') ?? '';
  for (const part of header.split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return 'fr';
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  const first = pathname.split('/')[1];
  if (!isLocale(first)) {
    const locale = detectLocale(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  const headers = new Headers(req.headers);
  headers.set('x-lang', first);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export { LOCALES };
