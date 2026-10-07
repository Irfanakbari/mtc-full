/** Use the configured browser-facing origin behind reverse proxies. Never trust arbitrary forwarded headers. */
export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (!origin || (fetchSite && fetchSite !== 'same-origin')) return false;
  try {
    const expected = new URL(process.env.VUTEQ_SSO_PUBLIC_ORIGIN || request.url);
    return ['http:', 'https:'].includes(expected.protocol) && origin === expected.origin;
  } catch {
    return false;
  }
}
