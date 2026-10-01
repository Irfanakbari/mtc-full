import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from './api-key.service';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './auth.decorators';
import type { CurrentUserIdentity } from './current-user.interface';
import { SsoAuthService } from './sso-auth.service';

@Injectable()
export class DualAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly sso: SsoAuthService, private readonly apiKeys: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined>; user?: CurrentUserIdentity }>();
    const rawApiKey = request.headers['x-api-key'];
    const apiKey = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey;
    let user: CurrentUserIdentity | null = null;
    if (apiKey) user = await this.apiKeys.authenticate(apiKey);
    else {
      const rawAuth = request.headers.authorization;
      const auth = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
      if (!auth?.toLowerCase().startsWith('bearer ')) throw new UnauthorizedException('Authentication required');
      const contextValue = await this.sso.authenticate(auth);
      user = {
        username: contextValue.user.id,
        name: contextValue.user.name ?? contextValue.user.username ?? contextValue.user.id,
        email: contextValue.user.email ?? '',
        roleName: contextValue.user.roles[0],
        permissions: contextValue.user.permissions,
        globalRoles: contextValue.user.globalRoles,
        authType: 'SSO',
      };
    }
    if (!user) throw new UnauthorizedException('Invalid authentication credentials');
    request.user = user;
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    const bypass = user.globalRoles?.includes('SUPER_ADMINISTRATOR') || user.roleName === 'SUPER' || user.permissions.includes('SUPER');
    if (!bypass && required.some((permission) => !user!.permissions.includes(permission))) throw new ForbiddenException('Insufficient permission');
    return true;
  }
}
