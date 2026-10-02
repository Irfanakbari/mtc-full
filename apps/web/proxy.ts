import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withBasePath, withoutBasePath } from './lib/base-path';

export function proxy(request: NextRequest) {
  const pathname = withoutBasePath(request.nextUrl.pathname);
  const hasCookie = request.cookies.has('mtc_sso') || request.cookies.has('__Host-mtc_sso');
  if (pathname === '/' && hasCookie) return NextResponse.redirect(new URL(withBasePath('/apps'), request.url));
  if (!hasCookie) {
    const reactServerRequest = request.headers.get('RSC') === '1' || request.nextUrl.searchParams.has('_rsc');
    return NextResponse.redirect(new URL(withBasePath(reactServerRequest ? '/' : '/auth/login'), request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/', '/apps/:path*'] };
