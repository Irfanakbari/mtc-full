import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VuteqSsoService, type VuteqAuthContext, type VuteqIdentity } from '@vuteq/sso-client-nest';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SsoAuthService implements OnModuleInit {
  private readonly logger = new Logger(SsoAuthService.name);
  private readonly service?: VuteqSsoService;
  private available = false;
  private readonly bootstrapAdminEmail?: string;

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    this.bootstrapAdminEmail = config.get<string>('BOOTSTRAP_ADMIN_EMAIL')?.trim().toLowerCase() || undefined;
    if (config.get<string>('VUTEQ_SSO_ENABLED') === 'false') return;
    try {
      this.service = new VuteqSsoService({
        baseUrl: config.get<string>('VUTEQ_SSO_BASE_URL') ?? '',
        secret: config.get<string>('VUTEQ_SSO_SECRET') ?? '',
        allowedClientIds: (config.get<string>('VUTEQ_SSO_ALLOWED_CLIENT_IDS') ?? '').split(',').map((v) => v.trim()).filter(Boolean),
        global: false,
        resolveAuthorization: (identity) => this.resolveAuthorization(identity),
      });
    } catch (error) { this.logUnavailable(error); }
  }

  async onModuleInit(): Promise<void> {
    if (!this.service) return;
    try { await this.service.metadata(); this.available = true; }
    catch (error) { this.logUnavailable(error); }
  }

  async authenticate(authorization: string): Promise<VuteqAuthContext> {
    if (!this.service || !this.available) throw new ServiceUnavailableException('Vuteq SSO authentication is unavailable');
    return this.service.authenticate(authorization);
  }

  private async resolveAuthorization(identity: VuteqIdentity) {
    const email = identity.email ?? `${identity.id}@sso.invalid`;
    const name = identity.name ?? identity.username ?? identity.id;
    const bySubject = await this.prisma.appUser.findUnique({ where: { SsoObjectId: identity.id } });
    const byEmail = bySubject ? null : await this.prisma.appUser.findUnique({ where: { Email: email } });
    const existing = bySubject ?? byEmail;
    const bootstrapRole = !existing && this.bootstrapAdminEmail === email.toLowerCase()
      ? await this.prisma.appRole.findUnique({ where: { Name: 'SUPER' } })
      : null;
    const user = existing
      ? await this.prisma.appUser.update({ where: { Id: existing.Id }, data: { SsoObjectId: identity.id, Email: email, Name: name, LastLogin: new Date() }, include: { Role: { include: { Permissions: true } } } })
      : await this.prisma.appUser.create({ data: { SsoObjectId: identity.id, Email: email, Name: name, CreatedBy: identity.id, LastLogin: new Date(), RoleId: bootstrapRole?.Id }, include: { Role: { include: { Permissions: true } } } });
    if (!user.IsActive) throw new Error('User account is inactive');
    return {
      roles: user.Role ? [user.Role.Name] : [],
      permissions: user.Role?.Permissions.map((p) => p.Action) ?? [],
      attributes: { applicationUserId: user.Id },
    };
  }

  private logUnavailable(error: unknown): void {
    const value = error as { name?: unknown; code?: unknown; message?: unknown };
    this.logger.error(JSON.stringify({ event: 'sso_startup_degraded', errorName: value.name, errorCode: value.code, errorMessage: value.message }));
  }
}
