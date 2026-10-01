import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('System Logs') @ApiBearerAuth() @Controller('system-logs')
export class SystemLogController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @Permission('MTC.SYSTEM_LOG_READ') async list(@Query('page') pageValue = '1', @Query('limit') limitValue = '50', @Query('search') search?: string) { const page = Math.max(1, Number(pageValue) || 1); const limit = Math.min(200, Math.max(1, Number(limitValue) || 50)); const where = search ? { OR: [{ FunctionId: { contains: search, mode: 'insensitive' as const } }, { FunctionName: { contains: search, mode: 'insensitive' as const } }, { Actor: { contains: search, mode: 'insensitive' as const } }] } : {}; const [total, data] = await Promise.all([this.prisma.processLog.count({ where }), this.prisma.processLog.findMany({ where, include: { Details: { orderBy: { CreatedAt: 'asc' } } }, orderBy: { StartedAt: 'desc' }, skip: (page - 1) * limit, take: limit })]); return { data, meta: { page, limit, totalItems: total, totalPages: Math.ceil(total / limit) } }; }
  @Get('audit') @Permission('MTC.SYSTEM_LOG_READ') audit() { return this.prisma.actionAuditEvent.findMany({ orderBy: { CreatedAt: 'desc' }, take: 200 }); }
}
