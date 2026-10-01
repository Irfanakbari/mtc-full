import { NextRequest, NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';
import { sso } from '@/lib/sso';

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!METHODS.has(request.method)) return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
  if (request.method !== 'GET') { const origin = request.headers.get('origin'); const fetchSite = request.headers.get('sec-fetch-site'); if ((origin && origin !== request.nextUrl.origin) || (fetchSite && !['same-origin', 'same-site'].includes(fetchSite))) return NextResponse.json({ message: 'Cross-origin mutation denied' }, { status: 403 }); }
  const { path } = await context.params; const [version, ...segments] = path; if (version !== 'v1' || !segments.length) return NextResponse.json({ message: 'Invalid API path' }, { status: 400 });
  const url = new URL(`${getApiUrl()}/${segments.map(encodeURIComponent).join('/')}`); url.search = request.nextUrl.search;
  const headers = new Headers(); for (const name of ['content-type', 'accept', 'idempotency-key', 'x-request-id']) { const value = request.headers.get(name); if (value) headers.set(name, value); }
  try { const response = await sso.fetch(request, url, { method: request.method, headers, body: request.method === 'GET' ? undefined : await request.arrayBuffer(), redirect: 'manual' }); const responseHeaders = new Headers(response.headers); responseHeaders.delete('set-cookie'); return new NextResponse(response.body, { status: response.status, headers: responseHeaders }); }
  catch (error) { if ((error as { name?: string }).name === 'VuteqAuthenticationError') return NextResponse.json({ message: 'Authentication required' }, { status: 401 }); console.error(JSON.stringify({ event: 'api_proxy_unavailable', errorName: (error as Error).name })); return NextResponse.json({ message: 'Backend service is unavailable' }, { status: 502 }); }
}
export const GET = handler; export const POST = handler; export const PUT = handler; export const PATCH = handler; export const DELETE = handler;
