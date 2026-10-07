import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    const oversized = typeof exception === 'object' && exception !== null && 'type' in exception && exception.type === 'entity.too.large';
    const status = oversized ? HttpStatus.PAYLOAD_TOO_LARGE : exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const raw = typeof payload === 'object' && payload !== null && 'message' in payload ? (payload as { message: unknown }).message : payload;
    const details = Array.isArray(raw) ? raw : undefined;
    if (status >= 500) Logger.error({ event: 'request_failed', path: request.path, errorName: exception instanceof Error ? exception.name : 'UnknownError', code: typeof exception === 'object' && exception !== null && 'code' in exception ? exception.code : undefined }, 'HttpExceptionFilter');
    const message = oversized ? 'Import request is too large. Use a smaller file.' : status >= 500 ? 'Internal server error' : details ? 'Request validation failed' : typeof raw === 'string' ? raw : 'Request failed';
    response.status(status).json({ success: false, statusCode: status, message, ...(details ? { details } : {}), timestamp: new Date().toISOString(), path: request.originalUrl });
  }
}
