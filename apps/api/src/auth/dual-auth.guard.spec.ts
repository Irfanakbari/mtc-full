import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './auth.decorators';

jest.mock('./sso-auth.service', () => ({
  SsoAuthService: class SsoAuthService {
    authenticate = jest.fn();
  },
}));

import { DualAuthGuard } from './dual-auth.guard';
import { SsoAuthService } from './sso-auth.service';
import { ApiKeyService } from './api-key.service';

describe('DualAuthGuard', () => {
  let guard: DualAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let sso: jest.Mocked<SsoAuthService>;
  let apiKeys: jest.Mocked<ApiKeyService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    sso = {
      authenticate: jest.fn(),
    } as unknown as jest.Mocked<SsoAuthService>;

    apiKeys = {
      authenticate: jest.fn(),
    } as unknown as jest.Mocked<ApiKeyService>;

    guard = new DualAuthGuard(reflector, sso, apiKeys);
  });

  function createMockContext(headers: Record<string, string>, requestObj?: Record<string, unknown>): ExecutionContext {
    const request = requestObj ?? { headers, user: undefined };
    if (!request.headers) request.headers = headers;
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('bypasses authentication for public endpoints', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });

    const context = createMockContext({});
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows SUPER_ADMINISTRATOR to bypass all permission requirements', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return ['MTC.ITEM.CREATE', 'MTC.USER_MANAGEMENT'];
      return undefined;
    });

    sso.authenticate.mockResolvedValue({
      user: {
        id: 'sso-super-1',
        name: 'Super User',
        username: 'superuser',
        email: 'super@vuteq.co.id',
        roles: [],
        permissions: [],
        globalRoles: ['SUPER_ADMINISTRATOR'],
      },
    } as any);

    const context = createMockContext({ authorization: 'Bearer token-super' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows RO_ADMINISTRATOR to access read-only endpoints and sets roleName to READONLY', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return ['MTC.ITEM.READ', 'MTC.ITEM.EXPORT'];
      return undefined;
    });

    sso.authenticate.mockResolvedValue({
      user: {
        id: 'sso-ro-1',
        name: 'Readonly User',
        username: 'rouser',
        email: 'ro@vuteq.co.id',
        roles: [],
        permissions: [],
        globalRoles: ['RO_ADMINISTRATOR'],
      },
    } as any);

    const req: Record<string, unknown> = {};
    const context = createMockContext({ authorization: 'Bearer token-ro' }, req);
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.user).toEqual(
      expect.objectContaining({
        roleName: 'READONLY',
        globalRoles: ['RO_ADMINISTRATOR'],
      }),
    );
  });

  it('allows RO_ADMINISTRATOR to access endpoints requiring MTC.SYSTEM_LOG_READ', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return ['MTC.SYSTEM_LOG_READ'];
      return undefined;
    });

    sso.authenticate.mockResolvedValue({
      user: {
        id: 'sso-ro-2',
        name: 'Readonly User 2',
        username: 'rouser2',
        email: 'ro2@vuteq.co.id',
        roles: [],
        permissions: [],
        globalRoles: ['RO_ADMINISTRATOR'],
      },
    } as any);

    const context = createMockContext({ authorization: 'Bearer token-ro-2' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('denies RO_ADMINISTRATOR access to write/mutation endpoints', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return ['MTC.ITEM.CREATE'];
      return undefined;
    });

    sso.authenticate.mockResolvedValue({
      user: {
        id: 'sso-ro-3',
        name: 'Readonly User 3',
        username: 'rouser3',
        email: 'ro3@vuteq.co.id',
        roles: [],
        permissions: [],
        globalRoles: ['RO_ADMINISTRATOR'],
      },
    } as any);

    const context = createMockContext({ authorization: 'Bearer token-ro-3' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('denies users lacking required permissions', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return ['MTC.ITEM.READ'];
      return undefined;
    });

    sso.authenticate.mockResolvedValue({
      user: {
        id: 'sso-regular-1',
        name: 'Regular User',
        username: 'reguser',
        email: 'reg@vuteq.co.id',
        roles: ['OPERATOR'],
        permissions: ['MTC.STOCK.IN'],
        globalRoles: [],
      },
    } as any);

    const context = createMockContext({ authorization: 'Bearer token-reg' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
