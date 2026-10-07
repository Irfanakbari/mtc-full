import { SystemLogController } from './system-log.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('System Log actor names', () => {
  const user = { Id: 'local-id', SsoObjectId: 'sso-id', Email: 'operator@example.com', Name: 'Warehouse Operator' };
  const rows = ['sso-id', 'local-id', 'operator@example.com', 'api-key:key-id', null, 'system:seed', '11111111-1111-4111-8111-111111111111'].map((Actor, Id) => ({ Id, Actor }));
  const prisma = {
    appUser: { findMany: jest.fn().mockResolvedValue([user]) },
    apiKey: { findMany: jest.fn().mockResolvedValue([{ Id: 'key-id', Name: 'Stock Station' }]) },
    processLog: { count: jest.fn().mockResolvedValue(rows.length), findMany: jest.fn().mockResolvedValue(rows) },
    actionAuditEvent: { findMany: jest.fn().mockResolvedValue(rows) },
  };
  const controller = new SystemLogController(prisma as unknown as PrismaService);

  it('resolves user and API-key names while preserving stored actor identifiers', async () => {
    const result = await controller.list();
    expect(result.data.map(row => row.ActorDisplayName)).toEqual(['Warehouse Operator', 'Warehouse Operator', 'Warehouse Operator', 'Stock Station', 'System', 'System Seed', 'Unknown user']);
    expect(result.data.map(row => row.Actor)).toEqual(rows.map(row => row.Actor));
  });

  it('filters by actor name before server-side pagination', async () => {
    await controller.list('2', '50', 'Warehouse');
    const query = prisma.processLog.findMany.mock.calls.at(-1)?.[0] as { where: { OR: unknown[] }; skip: number; take: number };
    expect(query.where.OR).toContainEqual({ Actor: { in: ['local-id', 'sso-id', 'operator@example.com', 'api-key:key-id'] } });
    expect(query.skip).toBe(50);
    expect(query.take).toBe(50);
  });

  it('also resolves names for audit history', async () => {
    expect((await controller.audit())[0].ActorDisplayName).toBe('Warehouse Operator');
  });
});
