import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import type { TransactionClient } from './inventory-transaction';
import { requestHash } from './request-hash';
export { requestHash } from './request-hash';

export async function claimCommand(tx: TransactionClient, operation: string, key: string, actor: string, payload: unknown): Promise<{ id: string; replay?: unknown }> {
  const hash = requestHash(payload);
  const id = randomUUID();
  const inserted = await tx.businessCommand.createMany({ data: [{ Id: id, Operation: operation, CommandKey: key, RequestHash: hash, Actor: actor }], skipDuplicates: true });
  if (inserted.count === 1) return { id };
  const existing = await tx.businessCommand.findUnique({ where: { Operation_CommandKey: { Operation: operation, CommandKey: key } } });
  if (!existing || existing.RequestHash !== hash) throw new ConflictException('Idempotency key was already used with a different request.');
  if (!existing.CompletedAt) throw new ConflictException('The matching command is still processing.');
  return { id: existing.Id, replay: existing.Result };
}

export async function finishCommand(tx: TransactionClient, id: string, result: unknown): Promise<void> {
  await tx.businessCommand.update({ where: { Id: id }, data: { Result: result as Prisma.InputJsonValue, CompletedAt: new Date() } });
}
