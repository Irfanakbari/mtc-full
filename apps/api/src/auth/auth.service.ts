import { Injectable } from '@nestjs/common';
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
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}
  async profile(ssoObjectId: string, globalRoles?: string[]) {
    const user = await this.prisma.appUser.findUnique({ where: { SsoObjectId: ssoObjectId }, include: { Role: { include: { Permissions: true } } } });
    if (!user) return null;

    const isRoAdmin = globalRoles?.includes('RO_ADMINISTRATOR') ?? false;
    let roleName = user.Role?.Name ?? null;
    let permissions = user.Role?.Permissions.map((p) => p.Action) ?? [];
    let accessStatus: 'PENDING' | 'ACTIVE' = user.RoleId === null ? 'PENDING' : 'ACTIVE';

    if (isRoAdmin) {
      const readonlyRole = await this.prisma.appRole.findUnique({
        where: { Name: 'READONLY' },
        include: { Permissions: true },
      });
      const readonlyPermissions = readonlyRole?.Permissions.map((p) => p.Action) ?? DEFAULT_READONLY_PERMISSIONS;
      permissions = Array.from(new Set([...permissions, ...readonlyPermissions]));
      if (!roleName) {
        roleName = 'READONLY';
      }
      accessStatus = 'ACTIVE';
    }

    return {
      Id: user.Id,
      SsoObjectId: user.SsoObjectId,
      Name: user.Name,
      Email: user.Email,
      IsActive: user.IsActive,
      RoleName: roleName,
      Permission: permissions,
      AccessStatus: accessStatus,
    };
  }
}
