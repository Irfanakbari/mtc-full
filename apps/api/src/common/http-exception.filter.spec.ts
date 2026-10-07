import { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HTTP payload errors', () => {
  it('reports oversized JSON as 413 instead of an internal server error', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = { switchToHttp: () => ({ getRequest: () => ({ originalUrl: '/v1/imports/items/commit' }), getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
    new HttpExceptionFilter().catch({ type: 'entity.too.large', status: 413 }, host);
    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 413, message: 'Import request is too large. Use a smaller file.' }));
  });
});
