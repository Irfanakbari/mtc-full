import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { InventoryTransactionType, OpnameStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { claimCommand, finishCommand } from '../common/business-command';
import { lockInventoryItem, withSerializableInventory, type TransactionClient } from '../common/inventory-transaction';
import { LedgerQueryDto, StockMutationDto } from './dto';
import { getDisplayNotes, getDisplayOperator } from './ledger-presentation';

const OPERATIONAL_TRANSACTION_TYPES: InventoryTransactionType[] = [
  InventoryTransactionType.STOCK_IN,
  InventoryTransactionType.STOCK_OUT,
  InventoryTransactionType.SCRAP,
];

@Injectable()
export class StockTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  mutate(type: 'STOCK_IN' | 'STOCK_OUT' | 'SCRAP', dto: StockMutationDto, idempotencyKey: string | undefined, actor: CurrentUserIdentity) {
    if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey)) throw new BadRequestException('A valid Idempotency-Key header is required');
    return withSerializableInventory(this.prisma, async (tx) => {
      const command = await claimCommand(tx, type, idempotencyKey, actor.username, dto);
      if (command.replay) return command.replay;
      await lockInventoryItem(tx, dto.itemId);
      const item = await tx.inventoryItem.findUnique({ where: { Id: dto.itemId } });
      if (!item) throw new NotFoundException('Inventory item not found');
      if (!item.IsActive) throw new ConflictException('Archived inventory items cannot be transacted');
      await this.assertNotFrozen(tx, dto.itemId);
      await this.assertReconciled(tx, dto.itemId, item.CurrentBalance);
      const quantity = new Prisma.Decimal(dto.quantity);
      const isIn = type === InventoryTransactionType.STOCK_IN;
      const after = isIn ? item.CurrentBalance.add(quantity) : item.CurrentBalance.sub(quantity);
      if (after.lessThan(0)) throw new ConflictException('Insufficient stock');
      const ledger = await tx.inventoryLedger.create({ data: { ItemId: item.Id, TransactionType: type, ReferenceDoc: dto.referenceDoc, BalanceBefore: item.CurrentBalance, QtyIn: isIn ? quantity : 0, QtyOut: isIn ? 0 : quantity, BalanceAfter: after, CreatedBy: actor.username, Notes: dto.notes, IdempotencyKey: idempotencyKey } });
      await tx.inventoryItem.update({ where: { Id: item.Id }, data: { CurrentBalance: after, UpdatedBy: actor.username } });
      const result = { ledger, item: { ...item, CurrentBalance: after } };
      await finishCommand(tx, command.id, JSON.parse(JSON.stringify(result)));
      await tx.actionAuditEvent.create({ data: { EntityType: 'InventoryLedger', EntityId: ledger.Id, Action: type, Actor: actor.username, After: JSON.parse(JSON.stringify(ledger)) } });
      return result;
    });
  }

  listTransactions(query: LedgerQueryDto) {
    return this.list(query, OPERATIONAL_TRANSACTION_TYPES);
  }


  async list(query: LedgerQueryDto, allowedTypes?: InventoryTransactionType[]) {
    const where: Prisma.InventoryLedgerWhereInput = {};
    if (query.itemId) where.ItemId = query.itemId;
    if (query.address) where.Item = { AddressLocation: { contains: query.address, mode: 'insensitive' } };
    if (allowedTypes) {
      where.TransactionType = query.transactionType && allowedTypes.includes(query.transactionType)
        ? query.transactionType
        : { in: query.transactionType ? [] : allowedTypes };
    } else if (query.transactionType) where.TransactionType = query.transactionType;
    if (query.actor) where.CreatedBy = { contains: query.actor, mode: 'insensitive' };
    if (query.search) where.OR = [{ ReferenceDoc: { contains: query.search, mode: 'insensitive' } }, { Item: { Model: { contains: query.search, mode: 'insensitive' } } }, { Item: { Name: { contains: query.search, mode: 'insensitive' } } }];
    if (query.from || query.to) where.TransactionDate = { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) };
    const [total, data] = await Promise.all([
      this.prisma.inventoryLedger.count({ where }),
      this.prisma.inventoryLedger.findMany({ where, include: { Item: { select: { Model: true, Name: true, AddressLocation: true, Unit: true } } }, orderBy: [{ TransactionDate: 'desc' }, { Id: 'desc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
    ]);
    return { data: await this.withActorDisplayNames(data), meta: { page: query.page, limit: query.limit, totalItems: total, totalPages: Math.ceil(total / query.limit) } };
  }

  async detail(id: string) {
    const ledger = await this.prisma.inventoryLedger.findUnique({ where: { Id: id }, include: { Item: true, ReversalOf: true, ReversedBy: true } });
    if (!ledger) throw new NotFoundException('Ledger entry not found');
    return (await this.withActorDisplayNames([ledger]))[0];
  }

  async reconcile(itemId?: string) {
    const items = await this.prisma.inventoryItem.findMany({ where: itemId ? { Id: itemId } : undefined, select: { Id: true, Model: true, CurrentBalance: true } });
    const result: Array<{ itemId: string; model: string | null; cachedBalance: Prisma.Decimal; ledgerBalance: Prisma.Decimal; reconciled: boolean }> = [];
    for (const item of items) {
      const aggregate = await this.prisma.inventoryLedger.aggregate({ where: { ItemId: item.Id }, _sum: { QtyIn: true, QtyOut: true } });
      const ledgerBalance = (aggregate._sum.QtyIn ?? new Prisma.Decimal(0)).sub(aggregate._sum.QtyOut ?? new Prisma.Decimal(0));
      result.push({ itemId: item.Id, model: item.Model, cachedBalance: item.CurrentBalance, ledgerBalance, reconciled: item.CurrentBalance.equals(ledgerBalance) });
    }
    return result;
  }

  private async withActorDisplayNames<T extends { CreatedBy: string; Notes: string | null }>(rows: T[]) {
    if (rows.length === 0) return [];
    const ssoIds = [...new Set(rows.map((row) => row.CreatedBy).filter((actor) => !actor.startsWith('api-key:')))];
    const apiKeyIds = [...new Set(rows.map((row) => row.CreatedBy).filter((actor) => actor.startsWith('api-key:')).map((actor) => actor.slice('api-key:'.length)))];
    const [users, apiKeys] = await Promise.all([
      ssoIds.length ? this.prisma.appUser.findMany({ where: { SsoObjectId: { in: ssoIds } }, select: { SsoObjectId: true, Name: true } }) : [],
      apiKeyIds.length ? this.prisma.apiKey.findMany({ where: { Id: { in: apiKeyIds } }, select: { Id: true, Name: true } }) : [],
    ]);
    const userNames = new Map<string, string>(users.map((user) => [user.SsoObjectId, user.Name] as const));
    const apiKeyNames = new Map<string, string>(apiKeys.map((apiKey) => [apiKey.Id, apiKey.Name] as const));

    return rows.map((row) => {
      const displayOperator = getDisplayOperator(row.Notes);
      const apiKeyId = row.CreatedBy.startsWith('api-key:') ? row.CreatedBy.slice('api-key:'.length) : null;
      const actorDisplayName = displayOperator
        ?? userNames.get(row.CreatedBy)
        ?? (apiKeyId ? apiKeyNames.get(apiKeyId) : undefined)
        ?? (row.CreatedBy === 'system:seed' ? 'System Seed' : row.CreatedBy);
      return { ...row, ActorDisplayName: actorDisplayName, Notes: getDisplayNotes(row.Notes) };
    });
  }


  private async assertNotFrozen(tx: TransactionClient, itemId: string): Promise<void> {
    const active = await tx.stockOpnameDetail.findFirst({ where: { ItemId: itemId, Opname: { Status: OpnameStatus.IN_PROGRESS } }, select: { Opname: { select: { RecordNumber: true } } } });
    if (active) throw new ConflictException(`Inventory item is frozen by inventory counting ${active.Opname.RecordNumber}`);
  }

  private async assertReconciled(tx: TransactionClient, itemId: string, cached: Prisma.Decimal): Promise<void> {
    const aggregate = await tx.inventoryLedger.aggregate({ where: { ItemId: itemId }, _sum: { QtyIn: true, QtyOut: true } });
    const ledger = (aggregate._sum.QtyIn ?? new Prisma.Decimal(0)).sub(aggregate._sum.QtyOut ?? new Prisma.Decimal(0));
    if (!cached.equals(ledger)) throw new ConflictException('Inventory balance does not match the ledger. Reconcile stock before continuing.');
  }
}
