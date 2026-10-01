import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { Prisma } from '../generated/prisma/client';
import { InventoryTransactionType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { claimCommand, finishCommand } from '../common/business-command';
import { withSerializableInventory } from '../common/inventory-transaction';
import { CommitImportDto, ImportItemRowDto } from './dto';

const HEADER = 'itemCode,name,brand,model,serialNumber,unit,addressLocation,openingBalance,minimumStock,referenceDoc,notes\n';

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}
  template(): Buffer { return Buffer.from(`${HEADER}MTC-001,Example Item,Example Brand,Model A,,PCS,A-01-01,10,2,OPENING-001,Initial stock\n`, 'utf8'); }

  async preview(file: Express.Multer.File) {
    if (!file || file.size > 5 * 1024 * 1024) throw new BadRequestException('CSV file is required and must be no larger than 5 MB');
    if (!file.originalname.toLowerCase().endsWith('.csv') || file.buffer.includes(0)) throw new BadRequestException('Only a valid text CSV file is allowed');
    let records: Record<string, string>[];
    try { records = parse(file.buffer, { columns: true, bom: true, skip_empty_lines: true, trim: true }) as Record<string, string>[]; }
    catch { throw new BadRequestException('CSV file is malformed'); }
    if (records.length > 5000) throw new BadRequestException('CSV import supports at most 5,000 rows');
    const rows: ImportItemRowDto[] = [];
    const errors: Array<{ rowNumber: number; field: string; message: string }> = [];
    const codes = new Set<string>(); const addresses = new Set<string>();
    const existing = await this.prisma.inventoryItem.findMany({ where: { OR: [{ ItemCode: { in: records.map((r) => r.itemCode).filter(Boolean) } }, { AddressLocation: { in: records.map((r) => r.addressLocation).filter(Boolean) } }] }, select: { ItemCode: true, AddressLocation: true } });
    const existingCodes = new Set(existing.map((v) => v.ItemCode.toLowerCase())); const existingAddresses = new Set(existing.map((v) => v.AddressLocation.toLowerCase()));
    records.forEach((record, index) => {
      const rowNumber = index + 2; const itemCode = record.itemCode?.trim(); const address = record.addressLocation?.trim(); const name = record.name?.trim();
      const opening = Number(record.openingBalance || 0); const minimum = Number(record.minimumStock || 0);
      if (!itemCode) errors.push({ rowNumber, field: 'itemCode', message: 'Item code is required' });
      if (!name) errors.push({ rowNumber, field: 'name', message: 'Name is required' });
      if (!address) errors.push({ rowNumber, field: 'addressLocation', message: 'Address location is required' });
      if (!Number.isFinite(opening) || opening < 0 || !/^\d+(\.\d{1,2})?$/.test(record.openingBalance || '0')) errors.push({ rowNumber, field: 'openingBalance', message: 'Opening balance must be a non-negative number with at most two decimals' });
      if (!Number.isFinite(minimum) || minimum < 0 || !/^\d+(\.\d{1,2})?$/.test(record.minimumStock || '0')) errors.push({ rowNumber, field: 'minimumStock', message: 'Minimum stock must be a non-negative number with at most two decimals' });
      if (itemCode && (codes.has(itemCode.toLowerCase()) || existingCodes.has(itemCode.toLowerCase()))) errors.push({ rowNumber, field: 'itemCode', message: 'Item code is duplicated or already exists' });
      if (address && (addresses.has(address.toLowerCase()) || existingAddresses.has(address.toLowerCase()))) errors.push({ rowNumber, field: 'addressLocation', message: 'Address location is duplicated or already exists' });
      if (itemCode) codes.add(itemCode.toLowerCase()); if (address) addresses.add(address.toLowerCase());
      rows.push({ rowNumber, itemCode, name, brand: record.brand || undefined, model: record.model || undefined, serialNumber: record.serialNumber || undefined, unit: record.unit || 'PCS', addressLocation: address, openingBalance: opening, minimumStock: minimum, referenceDoc: record.referenceDoc || undefined, notes: record.notes || undefined });
    });
    return { valid: errors.length === 0, rows, errors, summary: { totalRows: rows.length, validRows: rows.length - new Set(errors.map((e) => e.rowNumber)).size, invalidRows: new Set(errors.map((e) => e.rowNumber)).size } };
  }

  commit(dto: CommitImportDto, key: string | undefined, actor: CurrentUserIdentity) {
    if (!key || !/^[A-Za-z0-9._:-]{8,80}$/.test(key)) throw new BadRequestException('A valid Idempotency-Key header is required');
    if (!dto.rows.length || dto.rows.length > 5000) throw new BadRequestException('Import must contain between 1 and 5,000 rows');
    return withSerializableInventory(this.prisma, async (tx) => {
      const command = await claimCommand(tx, 'ITEM_IMPORT', key, actor.username, dto);
      if (command.replay) return command.replay;
      const created: Array<{ id: string; itemCode: string; rowNumber: number }> = [];
      for (const row of dto.rows) {
        const opening = new Prisma.Decimal(row.openingBalance);
        const item = await tx.inventoryItem.create({ data: { ItemCode: row.itemCode, Name: row.name, Brand: row.brand, Model: row.model, SerialNumber: row.serialNumber, Unit: row.unit, AddressLocation: row.addressLocation, CurrentBalance: opening, MinimumStock: row.minimumStock, CreatedBy: actor.username } });
        await tx.inventoryLedger.create({ data: { ItemId: item.Id, TransactionType: InventoryTransactionType.OPENING_BALANCE, ReferenceDoc: row.referenceDoc || `IMPORT-${key}`, BalanceBefore: 0, QtyIn: opening, QtyOut: 0, BalanceAfter: opening, CreatedBy: actor.username, Notes: row.notes, IdempotencyKey: `${key}:${row.rowNumber}` } });
        created.push({ id: item.Id, itemCode: item.ItemCode, rowNumber: row.rowNumber });
      }
      const result = { imported: created.length, items: created };
      await finishCommand(tx, command.id, result);
      return result;
    });
  }
}
