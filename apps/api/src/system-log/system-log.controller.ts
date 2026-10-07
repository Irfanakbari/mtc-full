import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

@ApiTags('System Logs') @ApiBearerAuth() @Controller('system-logs')
export class SystemLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() @Permission('MTC.SYSTEM_LOG_READ')
  async list(@Query('page') pageValue = '1', @Query('limit') limitValue = '50', @Query('search') search?: string) {
    const page = Math.max(1, Number(pageValue) || 1);
    const limit = Math.min(200, Math.max(1, Number(limitValue) || 50));
    const where: Prisma.ProcessLogWhereInput = {};
    if (search) {
      const [users, keys] = await Promise.all([
        this.prisma.appUser.findMany({ where: { Name: { contains: search, mode: 'insensitive' } }, select: { Id: true, SsoObjectId: true, Email: true } }),
        this.prisma.apiKey.findMany({ where: { Name: { contains: search, mode: 'insensitive' } }, select: { Id: true } }),
      ]);
      const actors = [...users.flatMap(user => [user.Id, user.SsoObjectId, user.Email]), ...keys.map(key => `api-key:${key.Id}`)];
      where.OR = [
        { FunctionId: { contains: search, mode: 'insensitive' } },
        { FunctionName: { contains: search, mode: 'insensitive' } },
        { Actor: { contains: search, mode: 'insensitive' } },
        { Actor: { in: actors } },
      ];
    }
    const [total, data] = await Promise.all([
      this.prisma.processLog.count({ where }),
      this.prisma.processLog.findMany({ where, include: { Details: { orderBy: { CreatedAt: 'asc' } } }, orderBy: { StartedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { data: await this.withActorNames(data), meta: { page, limit, totalItems: total, totalPages: Math.ceil(total / limit) } };
  }

  @Get('audit') @Permission('MTC.SYSTEM_LOG_READ')
  async audit() {
    return this.withActorNames(await this.prisma.actionAuditEvent.findMany({ orderBy: { CreatedAt: 'desc' }, take: 200 }));
  }

  private async withActorNames<T extends { Actor: string | null }>(rows: T[]) {
    const actors = [...new Set(rows.flatMap(row => row.Actor ? [row.Actor] : []))];
    const keyIds = actors.filter(actor => actor.startsWith('api-key:')).map(actor => actor.slice(8));
    const [users, keys] = await Promise.all([
      actors.length ? this.prisma.appUser.findMany({ where: { OR: [{ SsoObjectId: { in: actors } }, { Id: { in: actors } }, { Email: { in: actors } }] }, select: { Id: true, SsoObjectId: true, Email: true, Name: true } }) : [],
      keyIds.length ? this.prisma.apiKey.findMany({ where: { Id: { in: keyIds } }, select: { Id: true, Name: true } }) : [],
    ]);
    const names = new Map<string, string>();
    for (const user of users) for (const id of [user.Id, user.SsoObjectId, user.Email]) names.set(id, user.Name);
    for (const key of keys) names.set(`api-key:${key.Id}`, key.Name);
    return rows.map(row => ({ ...row, ActorDisplayName: row.Actor ? names.get(row.Actor) || (row.Actor === 'system:seed' ? 'System Seed' : row.Actor.startsWith('api-key:') ? 'Unknown API key' : /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(row.Actor) ? 'Unknown user' : row.Actor) : 'System' }));
  }
}
