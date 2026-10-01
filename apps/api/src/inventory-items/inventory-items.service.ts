import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Prisma } from '../generated/prisma/client';
import { InventoryTransactionType, OpnameStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { withSerializableInventory } from '../common/inventory-transaction';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { ArchiveItemDto, CreateInventoryItemDto, ItemQueryDto, UpdateInventoryItemDto } from './dto';

@Injectable()
export class InventoryItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInventoryItemDto, actor: CurrentUserIdentity) {
    return withSerializableInventory(this.prisma, async (tx) => {
      const opening = new Prisma.Decimal(dto.openingBalance ?? 0);
      const item = await tx.inventoryItem.create({ data: { ItemCode: dto.itemCode, Name: dto.name, Brand: dto.brand || null, Model: dto.model || null, SerialNumber: dto.serialNumber || null, Unit: dto.unit, AddressLocation: dto.addressLocation, MinimumStock: dto.minimumStock, CurrentBalance: opening, CreatedBy: actor.username } });
      if (dto.openingBalance !== undefined) {
        await tx.inventoryLedger.create({ data: { ItemId: item.Id, TransactionType: InventoryTransactionType.OPENING_BALANCE, ReferenceDoc: dto.referenceDoc || `OPENING-${item.ItemCode}`, BalanceBefore: 0, QtyIn: opening, QtyOut: 0, BalanceAfter: opening, CreatedBy: actor.username, Notes: dto.notes } });
      }
      await tx.actionAuditEvent.create({ data: { EntityType: 'InventoryItem', EntityId: item.Id, Action: 'CREATE', Actor: actor.username, After: JSON.parse(JSON.stringify(item)) } });
      return item;
    });
  }

  async findAll(query: ItemQueryDto) {
    const where: Prisma.InventoryItemWhereInput = {};
    if (query.active !== undefined) where.IsActive = query.active;
    if (query.address) where.AddressLocation = { contains: query.address, mode: 'insensitive' };
    if (query.search) where.OR = ['ItemCode', 'Name', 'Brand', 'Model', 'SerialNumber', 'AddressLocation'].map((key) => ({ [key]: { contains: query.search, mode: 'insensitive' } })) as Prisma.InventoryItemWhereInput[];
    if (query.lowStock) where.CurrentBalance = { lte: this.prisma.inventoryItem.fields.MinimumStock };
    const skip = (query.page - 1) * query.limit;
    const [total, data] = await Promise.all([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.findMany({ where, skip, take: query.limit, orderBy: { [query.sortBy]: query.sortOrder } }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, totalItems: total, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { Id: id } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async findByAddress(address: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { AddressLocation: address } });
    if (!item) throw new NotFoundException('No inventory item exists at this address location');
    return item;
  }

  async update(id: string, dto: UpdateInventoryItemDto, actor: CurrentUserIdentity) {
    const before = await this.findOne(id);
    const updated = await this.prisma.inventoryItem.update({ where: { Id: id }, data: { ItemCode: dto.itemCode, Name: dto.name, Brand: dto.brand, Model: dto.model, SerialNumber: dto.serialNumber, Unit: dto.unit, AddressLocation: dto.addressLocation, MinimumStock: dto.minimumStock, UpdatedBy: actor.username } });
    await this.prisma.actionAuditEvent.create({ data: { EntityType: 'InventoryItem', EntityId: id, Action: 'UPDATE', Actor: actor.username, Before: JSON.parse(JSON.stringify(before)), After: JSON.parse(JSON.stringify(updated)) } });
    return updated;
  }

  async archive(id: string, dto: ArchiveItemDto, actor: CurrentUserIdentity) {
    return withSerializableInventory(this.prisma, async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { Id: id } });
      if (!item) throw new NotFoundException('Inventory item not found');
      if (!item.IsActive) throw new ConflictException('Inventory item is already archived');
      if (!item.CurrentBalance.equals(0)) throw new ConflictException('Inventory item must have zero balance before it can be archived');
      const activeCount = await tx.stockOpnameDetail.count({ where: { ItemId: id, Opname: { Status: OpnameStatus.IN_PROGRESS } } });
      if (activeCount) throw new ConflictException('Inventory item is part of an active inventory counting session');
      return tx.inventoryItem.update({ where: { Id: id }, data: { IsActive: false, DiscontinuedAt: new Date(), DiscontinueReason: dto.reason, UpdatedBy: actor.username } });
    });
  }

  async reactivate(id: string, actor: CurrentUserIdentity) {
    await this.findOne(id);
    return this.prisma.inventoryItem.update({ where: { Id: id }, data: { IsActive: true, DiscontinuedAt: null, DiscontinueReason: null, UpdatedBy: actor.username } });
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    const [ledger, opname] = await Promise.all([this.prisma.inventoryLedger.count({ where: { ItemId: id } }), this.prisma.stockOpnameDetail.count({ where: { ItemId: id } })]);
    if (ledger || opname) throw new ConflictException('Items with ledger or inventory counting history cannot be deleted');
    await this.prisma.inventoryItem.delete({ where: { Id: id } });
    return { deleted: true, id: item.Id };
  }

  async export(query: ItemQueryDto): Promise<Buffer> {
    const first = await this.findAll({ ...query, page: 1, limit: 200 } as ItemQueryDto);
    const rows = [...first.data];
    for (let page = 2; page <= first.meta.totalPages; page += 1) {
      rows.push(...(await this.findAll({ ...query, page, limit: 200 } as ItemQueryDto)).data);
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventory Items', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'Item Code', key: 'code', width: 20 }, { header: 'Name', key: 'name', width: 35 }, { header: 'Brand', key: 'brand', width: 18 }, { header: 'Model', key: 'model', width: 18 }, { header: 'Serial Number', key: 'serial', width: 22 }, { header: 'Unit', key: 'unit', width: 10 }, { header: 'Address Location', key: 'address', width: 22 }, { header: 'Current Balance', key: 'balance', width: 18 }, { header: 'Minimum Stock', key: 'minimum', width: 18 }, { header: 'Status', key: 'status', width: 12 },
    ];
    for (const item of rows) sheet.addRow({ code: item.ItemCode, name: item.Name, brand: item.Brand, model: item.Model, serial: item.SerialNumber, unit: item.Unit, address: item.AddressLocation, balance: Number(item.CurrentBalance), minimum: Number(item.MinimumStock), status: item.IsActive ? 'Active' : 'Archived' });
    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output);
  }
}
