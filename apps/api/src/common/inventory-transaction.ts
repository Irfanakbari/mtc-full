import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TransactionClient = Prisma.TransactionClient;

export async function lockInventoryItem(tx: TransactionClient, itemId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemId}))`;
}

export async function withSerializableInventory<T>(prisma: PrismaService, operation: (tx: TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
      if (!retryable || attempt === 3) {
        if (retryable) throw new ConflictException('Inventory changed concurrently. Please retry the transaction.');
        throw error;
      }
    }
  }
  throw new ConflictException('Inventory changed concurrently. Please retry the transaction.');
}
