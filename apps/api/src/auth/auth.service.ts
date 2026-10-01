import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}
  async profile(ssoObjectId: string) {
    const user = await this.prisma.appUser.findUnique({ where: { SsoObjectId: ssoObjectId }, include: { Role: { include: { Permissions: true } } } });
    if (!user) return null;
    return { Id: user.Id, SsoObjectId: user.SsoObjectId, Name: user.Name, Email: user.Email, IsActive: user.IsActive, RoleName: user.Role?.Name ?? null, Permission: user.Role?.Permissions.map((p) => p.Action) ?? [] };
  }
}
