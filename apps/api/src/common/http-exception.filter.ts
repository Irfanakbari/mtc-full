import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const raw = typeof payload === 'object' && payload !== null && 'message' in payload ? (payload as { message: unknown }).message : payload;
    const details = Array.isArray(raw) ? raw : undefined;
    const message = status >= 500 ? 'Internal server error' : details ? 'Request validation failed' : typeof raw === 'string' ? raw : 'Request failed';
    response.status(status).json({ success: false, statusCode: status, message, ...(details ? { details } : {}), timestamp: new Date().toISOString(), path: request.originalUrl });
  }
}
