import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  start(functionId: string, functionName: string, actor?: string, requestId?: string) {
    return this.prisma.processLog.create({ data: { FunctionId: functionId, FunctionName: functionName, Actor: actor, RequestId: requestId } });
  }
  detail(processId: string, level: string, message: string) {
    return this.prisma.processLogDetail.create({ data: { ProcessId: processId, Level: level, Message: message.slice(0, 2000) } });
  }
  finish(id: string, status: 'SUCCESS' | 'FAILED', summary?: string) {
    return this.prisma.processLog.update({ where: { Id: id }, data: { Status: status, CompletedAt: new Date(), Summary: summary?.slice(0, 1000) } });
  }
}
