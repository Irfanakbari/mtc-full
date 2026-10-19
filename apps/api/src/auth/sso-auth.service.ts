import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VuteqSsoService, type VuteqAccessClaims, type VuteqAuthContext, type VuteqIdentity } from '@vuteq/sso-client-nest';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_READONLY_PERMISSIONS = [
  'MTC.DASHBOARD.READ',
  'MTC.ITEM.READ',
  'MTC.ITEM.EXPORT',
  'MTC.STOCK.READ',
  'MTC.OPNAME.READ',
  'MTC.SYSTEM_LOG_READ',
];

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
        resolveAuthorization: (identity, claims) => this.resolveAuthorization(identity, claims),
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

  private async resolveAuthorization(identity: VuteqIdentity, claims?: VuteqAccessClaims) {
    const email = identity.email ? identity.email.trim().toLowerCase() : `${identity.id}@sso.invalid`;
    const name = identity.name ?? identity.username ?? identity.id;
    const actor = identity.id;

    // 1. Primary lookup by immutable SSO Subject
    let existing = await this.prisma.appUser.findUnique({
      where: { SsoObjectId: identity.id },
      include: { Role: { include: { Permissions: true } } },
    });

    // 2. Safe Fallback: lookup by Email only if user is not found and email is a valid real email
    if (!existing && identity.email) {
      const byEmail = await this.prisma.appUser.findUnique({
        where: { Email: email },
        include: { Role: { include: { Permissions: true } } },
      });
      // Only link if the existing record doesn't already have a different SsoObjectId
      if (byEmail && (!byEmail.SsoObjectId || byEmail.SsoObjectId === identity.id)) {
        existing = byEmail;
      }
    }

    const bootstrapRole = !existing && this.bootstrapAdminEmail && this.bootstrapAdminEmail === email
      ? await this.prisma.appRole.findUnique({ where: { Name: 'SUPER' } })
      : null;

    const user = existing
      ? await this.prisma.appUser.update({
          where: { Id: existing.Id },
          data: {
            SsoObjectId: identity.id,
            Email: email,
            Name: name,
            LastLogin: new Date(),
            UpdatedBy: actor,
          },
          include: { Role: { include: { Permissions: true } } },
        })
      : await this.prisma.appUser.create({
          data: {
            SsoObjectId: identity.id,
            Email: email,
            Name: name,
            CreatedBy: actor,
            UpdatedBy: actor,
            LastLogin: new Date(),
            RoleId: bootstrapRole?.Id ?? null,
          },
          include: { Role: { include: { Permissions: true } } },
        });

    if (!user.IsActive) throw new Error('User account is inactive');

    const isRoAdmin = claims?.roles?.includes('RO_ADMINISTRATOR') ?? false;
    let effectiveRoles = user.Role ? [user.Role.Name] : [];
    let effectivePermissions = user.Role?.Permissions.map((p) => p.Action) ?? [];

    if (isRoAdmin) {
      const readonlyRole = await this.prisma.appRole.findUnique({
        where: { Name: 'READONLY' },
        include: { Permissions: true },
      });
      const readonlyPermissions = readonlyRole?.Permissions.map((p) => p.Action) ?? DEFAULT_READONLY_PERMISSIONS;
      effectivePermissions = Array.from(new Set([...effectivePermissions, ...readonlyPermissions]));
      if (effectiveRoles.length === 0) {
        effectiveRoles = ['READONLY'];
      }
    }

    return {
      roles: effectiveRoles,
      permissions: effectivePermissions,
      attributes: {
        applicationUserId: user.Id,
        accessStatus: user.RoleId === null && !isRoAdmin ? 'PENDING' : 'ACTIVE',
      },
    };
  }

  private logUnavailable(error: unknown): void {
    const value = error as { name?: unknown; code?: unknown; message?: unknown };
    this.logger.error(JSON.stringify({ event: 'sso_startup_degraded', errorName: value.name, errorCode: value.code, errorMessage: value.message }));
  }
}
