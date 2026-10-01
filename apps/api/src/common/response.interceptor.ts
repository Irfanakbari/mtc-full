import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Stream } from 'node:stream';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(map((result) => {
      if (response.statusCode === 204 || response.headersSent || result instanceof StreamableFile || result instanceof Stream || Buffer.isBuffer(result)) return result;
      if (result && typeof result === 'object' && 'success' in result) return result;
      const paged = result && typeof result === 'object' && 'data' in result && 'meta' in result ? result as { data: unknown; meta: unknown } : null;
      return { success: true, statusCode: response.statusCode, message: response.statusCode === 201 ? 'Resource created successfully' : 'Request successful', data: paged ? paged.data : result ?? null, ...(paged ? { meta: paged.meta } : {}), timestamp: new Date().toISOString(), path: request.originalUrl };
    }));
  }
}
