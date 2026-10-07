import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { InventoryTransactionType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { claimCommand, finishCommand } from '../common/business-command';
import { withSerializableInventory } from '../common/inventory-transaction';
import { CommitImportDto, ImportItemRowDto } from './dto';

const HEADERS = ['name', 'model', 'specification', 'addressLocation', 'unit', 'openingBalance', 'minimumStock', 'referenceDoc', 'notes', 'classification'];

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}
  async template(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Part Master', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = HEADERS.map((header) => ({ header, key: header, width: header === 'specification' || header === 'notes' ? 45 : 24 }));
    sheet.getRow(1).height = 26;
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
      cell.note = ['name', 'addressLocation'].includes(cell.text)
        ? 'Required. Enter one part per row. Location must be unique.'
        : 'Optional. Unit defaults to PCS; opening balance and minimum stock default to 0. Use plain values, not formulas.';
    });
    for (const field of ['name', 'model', 'specification', 'addressLocation', 'unit', 'referenceDoc', 'notes', 'classification']) sheet.getColumn(field).numFmt = '@';
    for (const field of ['openingBalance', 'minimumStock']) sheet.getColumn(field).numFmt = '0.00';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async preview(file: Express.Multer.File) {
    if (!file || !file.buffer?.length || file.buffer.length > 5 * 1024 * 1024) throw new BadRequestException('XLSX file is required and must be no larger than 5 MB');
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) throw new BadRequestException('Only XLSX files are allowed');
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer); }
    catch { throw new BadRequestException('XLSX file is malformed or unsupported'); }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) throw new BadRequestException('Enter at least one part below the template headers');
    if (sheet.rowCount > 5001) throw new BadRequestException('XLSX import supports at most 5,000 data rows');
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
      const header = cell.text.trim();
      if (!HEADERS.includes(header) || headers.includes(header)) throw new BadRequestException('Invalid or duplicate column. Download the current XLSX template.');
      headers[column - 1] = header;
    });
    if (!headers.includes('name') || !headers.includes('addressLocation')) throw new BadRequestException('The name and addressLocation columns are required');
    const records: Array<{ rowNumber: number; values: Record<string, string> }> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values: Record<string, string> = {};
      row.eachCell((cell, column) => {
        if (!headers[column - 1]) throw new BadRequestException(`Row ${rowNumber} has a value without a column header`);
        if (typeof cell.value !== 'string' && typeof cell.value !== 'number' && cell.value !== null) throw new BadRequestException(`Row ${rowNumber}: use plain text or numbers, not formulas or other cell types`);
        values[headers[column - 1]] = cell.text.trim();
      });
      if (Object.values(values).some(Boolean)) records.push({ rowNumber, values });
    });
    if (!records.length) throw new BadRequestException('Enter at least one part below the template headers');
    const rows: ImportItemRowDto[] = [];
    const errors: Array<{ rowNumber: number; field: string; message: string }> = [];
    const addresses = new Set<string>();
    const existing = await this.prisma.inventoryItem.findMany({
      where: {
        OR: [
          { AddressLocation: { in: records.map((r) => r.values.addressLocation?.trim()).filter(Boolean), mode: 'insensitive' } },
        ],
      },
      select: { AddressLocation: true },
    });
    const existingAddresses = new Set(existing.map((v) => v.AddressLocation.toLowerCase()));
    records.forEach(({ rowNumber, values: record }) => {
      const address = record.addressLocation?.trim(); const name = record.name?.trim();
      const opening = Number(record.openingBalance || 0); const minimum = Number(record.minimumStock || 0);
      for (const [field, max] of Object.entries({ name: 200, model: 120, specification: 1000, addressLocation: 120, unit: 30, referenceDoc: 160, notes: 1000 })) {
        if ((record[field]?.trim().length ?? 0) > max) errors.push({ rowNumber, field, message: `Maximum length is ${max} characters` });
      }
      if (!name) errors.push({ rowNumber, field: 'name', message: 'Name is required' });
      if (!address) errors.push({ rowNumber, field: 'addressLocation', message: 'Address location is required' });
      if (!Number.isFinite(opening) || opening < 0 || !/^\d+(\.\d{1,2})?$/.test(record.openingBalance || '0')) errors.push({ rowNumber, field: 'openingBalance', message: 'Opening balance must be a non-negative number with at most two decimals' });
      if (!Number.isFinite(minimum) || minimum < 0 || !/^\d+(\.\d{1,2})?$/.test(record.minimumStock || '0')) errors.push({ rowNumber, field: 'minimumStock', message: 'Minimum stock must be a non-negative number with at most two decimals' });
      if (address && (addresses.has(address.toLowerCase()) || existingAddresses.has(address.toLowerCase()))) errors.push({ rowNumber, field: 'addressLocation', message: 'Address location is duplicated or already exists' });
      if (address) addresses.add(address.toLowerCase());
      rows.push({ rowNumber, name, model: record.model?.trim() || undefined, specification: record.specification?.trim() || undefined, classification: record.classification?.trim() || undefined, unit: record.unit?.trim() || 'PCS', addressLocation: address, openingBalance: opening, minimumStock: minimum, referenceDoc: record.referenceDoc?.trim() || undefined, notes: record.notes?.trim() || undefined });
    });
    return { valid: errors.length === 0, rows, errors, summary: { totalRows: rows.length, validRows: rows.length - new Set(errors.map((e) => e.rowNumber)).size, invalidRows: new Set(errors.map((e) => e.rowNumber)).size } };
  }

  async commit(dto: CommitImportDto, key: string | undefined, actor: CurrentUserIdentity) {
    if (!key || !/^[A-Za-z0-9._:-]{8,80}$/.test(key)) throw new BadRequestException('A valid Idempotency-Key header is required');
    if (!dto.rows.length || dto.rows.length > 5000) throw new BadRequestException('Import must contain between 1 and 5,000 rows');
    const locations = new Set<string>();
    const rowNumbers = new Set<number>();
    const rows = dto.rows.map(row => {
      const addressLocation = row.addressLocation.trim();
      if (!row.name.trim() || !addressLocation || !row.unit.trim()) throw new BadRequestException(`Row ${row.rowNumber}: name, location, and unit are required`);
      if (locations.has(addressLocation.toLowerCase())) throw new BadRequestException(`Row ${row.rowNumber}: address location is duplicated`);
      if (rowNumbers.has(row.rowNumber)) throw new BadRequestException(`Row ${row.rowNumber}: duplicate row number`);
      locations.add(addressLocation.toLowerCase());
      rowNumbers.add(row.rowNumber);
      return { ...row, addressLocation, name: row.name.trim(), unit: row.unit.trim() };
    });
    try {
      return await withSerializableInventory(this.prisma, async (tx) => {
        const command = await claimCommand(tx, 'ITEM_IMPORT', key, actor.username, dto);
        if (command.replay) return command.replay;
        const existing = await tx.inventoryItem.findMany({ where: { AddressLocation: { in: rows.map(row => row.addressLocation), mode: 'insensitive' } }, select: { AddressLocation: true } });
        if (existing.length) throw new ConflictException('One or more locations already exist. Preview the file again before importing.');
        const created = rows.map(row => ({ id: randomUUID(), name: row.name, rowNumber: row.rowNumber }));
        // Keep the entire file atomic, but avoid two database round trips per row.
        for (let offset = 0; offset < rows.length; offset += 250) {
          const batch = rows.slice(offset, offset + 250);
          await tx.inventoryItem.createMany({ data: batch.map((row, index) => ({
            Id: created[offset + index].id, Name: row.name, Model: row.model?.trim() || null,
            Specification: row.specification?.trim() || null, Classification: row.classification?.trim() || null,
            Unit: row.unit, AddressLocation: row.addressLocation, CurrentBalance: new Prisma.Decimal(row.openingBalance),
            MinimumStock: row.minimumStock, CreatedBy: actor.username,
          })) });
          await tx.inventoryLedger.createMany({ data: batch.map((row, index) => ({
            ItemId: created[offset + index].id, TransactionType: InventoryTransactionType.OPENING_BALANCE,
            ReferenceDoc: row.referenceDoc || `IMPORT-${key}`, BalanceBefore: 0,
            QtyIn: new Prisma.Decimal(row.openingBalance), QtyOut: 0, BalanceAfter: new Prisma.Decimal(row.openingBalance),
            CreatedBy: actor.username, Notes: row.notes,
            IdempotencyKey: createHash('sha256').update(`${key}:${row.rowNumber}`).digest('hex'),
          })) });
        }
        const result = { imported: created.length, items: created };
        await finishCommand(tx, command.id, result);
        return result;
      }, { timeout: 60_000, maxWait: 10_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A location was imported by another request. Preview the file again.');
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') throw new ConflictException('Import transaction timed out and was rolled back. Retry the import.');
      throw error;
    }
  }
}
