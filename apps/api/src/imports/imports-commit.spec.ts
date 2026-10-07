import { ImportsService } from './imports.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { requestHash } from '../common/request-hash';

describe('atomic bulk import', () => {
  const actor: CurrentUserIdentity = { username: 'test', name: 'Test', email: '', permissions: [], authType: 'SSO' };
  const rows = Array.from({ length: 501 }, (_, index) => ({ rowNumber: index + 2, name: 'Part', addressLocation: `A-${index}`, unit: 'PCS', openingBalance: 2.5, minimumStock: 0 }));
  function setup() {
    const tx = {
      businessCommand: { createMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({}), findUnique: jest.fn() },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn().mockResolvedValue({}) },
      inventoryLedger: { createMany: jest.fn().mockResolvedValue({}) },
    };
    const transaction = jest.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx));
    return { tx, service: new ImportsService({ $transaction: transaction } as unknown as PrismaService) };
  }
  it('links each batched item to an opening ledger with bounded idempotency keys', async () => {
    const { service, tx } = setup();
    await service.commit({ rows }, 'x'.repeat(80), actor);
    const items = tx.inventoryItem.createMany.mock.calls.flatMap(([input]) => input.data as Array<{ Id: string; CurrentBalance: { toString(): string } }>);
    const ledger = tx.inventoryLedger.createMany.mock.calls.flatMap(([input]) => input.data as Array<{ ItemId: string; IdempotencyKey: string; BalanceAfter: { toString(): string } }>);
    expect(items).toHaveLength(501);
    expect(ledger.map(row => row.ItemId)).toEqual(items.map(row => row.Id));
    expect(ledger.every(row => row.IdempotencyKey.length <= 80 && row.BalanceAfter.toString() === '2.5')).toBe(true);
    expect(new Set(ledger.map(row => row.IdempotencyKey)).size).toBe(501);
  });
  it('rejects locations that appeared after preview before writing any parts', async () => {
    const { service, tx } = setup();
    tx.inventoryItem.findMany.mockResolvedValue([{ AddressLocation: 'A-0' }]);
    await expect(service.commit({ rows }, 'request-key', actor)).rejects.toThrow('already exist');
    expect(tx.inventoryItem.createMany).not.toHaveBeenCalled();
  });
  it('replays a completed request without inserting more parts or ledger rows', async () => {
    const { service, tx } = setup();
    tx.businessCommand.createMany.mockResolvedValue({ count: 0 });
    tx.businessCommand.findUnique.mockResolvedValue({ Id: 'command', RequestHash: requestHash({ rows }), CompletedAt: new Date(), Result: { imported: 501 } });
    expect(await service.commit({ rows }, 'request-key', actor)).toEqual({ imported: 501 });
    expect(tx.inventoryItem.createMany).not.toHaveBeenCalled();
    expect(tx.inventoryLedger.createMany).not.toHaveBeenCalled();
  });
  it('rejects duplicate locations in a direct commit', async () => {
    await expect(setup().service.commit({ rows: [rows[0], { ...rows[0], rowNumber: 3 }] }, 'request-key', actor)).rejects.toThrow('duplicated');
  });
});
