import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, from, map, mergeMap, Observable, switchMap, throwError } from 'rxjs';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { AuditService } from './audit.service';

@Injectable()
export class ProcessLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ProcessLogInterceptor.name);
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method: string; originalUrl?: string; url: string; requestId?: string; user?: CurrentUserIdentity }>();
    if (request.method === 'GET') return next.handle();
    const functionId = `${request.method} ${(request.originalUrl ?? request.url).split('?')[0]}`;
    return from(this.audit.start(functionId, context.getHandler().name, request.user?.username, request.requestId)).pipe(
      switchMap((process) => next.handle().pipe(
        catchError((error: unknown) => {
          return from(this.finish(process.Id, 'FAILED', error instanceof Error ? error.message : 'Request failed')).pipe(mergeMap(() => throwError(() => error)));
        }),
        mergeMap((value) => from(this.finish(process.Id, 'SUCCESS')).pipe(map(() => value))),
      )),
    );
  }

  private async finish(id: string, status: 'SUCCESS' | 'FAILED', summary?: string): Promise<void> {
    try { await this.audit.finish(id, status, summary); }
    catch (error) { this.logger.error(JSON.stringify({ event: 'process_log_finish_failed', processId: id, errorName: error instanceof Error ? error.name : 'UnknownError' })); }
  }
}
