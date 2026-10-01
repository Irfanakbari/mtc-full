import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserIdentity } from './current-user.interface';

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(secret: string): Promise<CurrentUserIdentity | null> {
    const prefix = secret.slice(0, 12);
    const key = await this.prisma.apiKey.findUnique({ where: { Prefix: prefix } });
    if (!key?.IsActive || (key.ExpiresAt && key.ExpiresAt <= new Date())) return null;
    if (!(await bcrypt.compare(secret, key.SecretHash))) return null;
    await this.prisma.apiKey.update({ where: { Id: key.Id }, data: { LastUsedAt: new Date() } });
    return { username: `api-key:${key.Id}`, name: key.Name, email: '', permissions: key.Permissions, authType: 'API_KEY' };
  }
}
