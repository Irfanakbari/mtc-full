/*By Irfan Akbari Vuteq Indonesia - 2026-09-15*/

import { toClientSession } from '@vuteq/sso-client-react';
import { getApiUrl } from '@/lib/config';
import { sso } from '@/lib/sso';

export const dynamic = 'force-dynamic';

type LocalProfile = {
  Id?: string;
  SsoObjectId?: string;
  Name?: string;
  Email?: string | null;
  IsActive?: boolean;
  RoleName?: string | null;
  Permission?: string[] | null;
  AccessStatus?: 'ACTIVE' | 'PENDING' | 'BLOCKED' | 'UNAVAILABLE';
};

export async function GET(request: Request): Promise<Response> {
  const session = await sso.session(request);
  if (!session) return staleSessionResponse();

  let response: Response;
  try {
    response = await sso.fetch(request, `${getApiUrl()}/auth/profile`, { cache: 'no-store' });
  } catch (error: unknown) {
    const failure = error as {
      name?: unknown;
      code?: unknown;
      cause?: { name?: unknown; code?: unknown };
    };
    console.warn(
      JSON.stringify({
        event: 'local_auth_profile_unavailable',
        errorName: failure.name,
        errorCode: failure.code,
        causeName: failure.cause?.name,
        causeCode: failure.cause?.code,
      }),
    );
    return Response.json(
      toClientSession(session, {
        attributes: { AccessStatus: 'UNAVAILABLE' },
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (response.status === 401) return staleSessionResponse();
  if (!response.ok) {
    return Response.json(
      toClientSession(session, {
        attributes: {
          AccessStatus: response.status === 503 ? 'UNAVAILABLE' : 'BLOCKED',
        },
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const record =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : null;
  const profile = (record && 'data' in record ? record.data : record) as
    | LocalProfile
    | undefined;

  if (!profile || typeof profile !== 'object') {
    return Response.json(
      { message: 'The local authorization profile is unavailable' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const globalSuper = session.globalRoles.includes('SUPER_ADMINISTRATOR');
  if (globalSuper) {
    profile.RoleName = 'SUPER';
    profile.Permission = [...new Set([...(profile.Permission ?? []), 'SUPER'])];
    profile.AccessStatus = 'ACTIVE';
  } else if (!profile.RoleName) {
    profile.AccessStatus = 'PENDING';
  }

  return Response.json(
    toClientSession(session, {
      roles: profile.RoleName ? [profile.RoleName] : [],
      permissions: profile.Permission ?? [],
      attributes: profile,
    }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

function staleSessionResponse(): Response {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  headers.append(
    'Set-Cookie',
    '__Host-mtc_sso=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
  );
  headers.append(
    'Set-Cookie',
    'mtc_sso=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  );
  return Response.json(null, { headers });
}
