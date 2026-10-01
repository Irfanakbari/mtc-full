import { Controller, Get, Headers, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health') @Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  @Public() @Get('live') live() { return { status: 'alive', timestamp: new Date().toISOString() }; }
  @Public() @Get('ready') @ApiExcludeEndpoint() async ready(@Headers('x-health-token') token?: string) { this.authorize(token); try { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ready', database: 'up' }; } catch { throw new ServiceUnavailableException('Database is unavailable'); } }
  private authorize(token?: string) { if (this.config.get<string>('HEALTH_READINESS_PROTECTED') !== 'true') return; const expected = Buffer.from(this.config.get<string>('HEALTH_READINESS_TOKEN') ?? ''); const actual = Buffer.from(token ?? ''); if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new UnauthorizedException('Readiness authentication failed'); }
}
