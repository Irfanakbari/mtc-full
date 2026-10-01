import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { InventoryTransactionType, OpnameScope, OpnameStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { lockInventoryItem, withSerializableInventory } from '../common/inventory-transaction';
import { ApproveOpnameDto, BatchCountDto, CountItemDto, CreateOpnameDto, OpnameQueryDto } from './dto';

@Injectable()
export class InventoryCountingService {
  private readonly storageRoot: string;
  constructor(private readonly prisma: PrismaService, config: ConfigService) {
    this.storageRoot = resolve(config.get<string>('STORAGE_PATH') ?? './storage', 'inventory-counting');
    if (!existsSync(this.storageRoot)) mkdirSync(this.storageRoot, { recursive: true });
  }

  create(dto: CreateOpnameDto, actor: CurrentUserIdentity) {
    if (dto.scope === OpnameScope.SELECTED_ITEMS && (!dto.itemIds?.length)) throw new BadRequestException('Selected item scope requires at least one item');
    if (dto.scope === OpnameScope.ALL_ACTIVE_ITEMS && dto.itemIds?.length) throw new BadRequestException('All active item scope must not include selected item IDs');
    if (dto.itemIds && new Set(dto.itemIds).size !== dto.itemIds.length) throw new BadRequestException('Duplicate selected item IDs are not allowed');
    return withSerializableInventory(this.prisma, async (tx) => {
      const today = new Date(); const businessDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())); const prefix = 'STO';
      const counter = await tx.recordNumberCounter.upsert({ where: { Prefix_BusinessDate: { Prefix: prefix, BusinessDate: businessDate } }, create: { Prefix: prefix, BusinessDate: businessDate, LastSequence: 1 }, update: { LastSequence: { increment: 1 } } });
      const recordNumber = `${prefix}-${today.toISOString().slice(0, 10).replace(/-/g, '')}-${String(counter.LastSequence).padStart(3, '0')}`;
      if (dto.itemIds?.length) {
        const count = await tx.inventoryItem.count({ where: { Id: { in: dto.itemIds }, IsActive: true } });
        if (count !== dto.itemIds.length) throw new BadRequestException('One or more selected items do not exist or are archived');
      }
      return tx.stockOpname.create({ data: { RecordNumber: recordNumber, Scope: dto.scope, Notes: dto.notes, CreatedBy: actor.username, ...(dto.itemIds?.length ? { Selections: { createMany: { data: dto.itemIds.map((ItemId) => ({ ItemId })) } } } : {}) }, include: { Selections: true } });
    });
  }

  async list(query: OpnameQueryDto) {
    const where: Prisma.StockOpnameWhereInput = { ...(query.status ? { Status: query.status } : {}), ...(query.search ? { OR: [{ RecordNumber: { contains: query.search, mode: 'insensitive' } }, { CreatedBy: { contains: query.search, mode: 'insensitive' } }] } : {}) };
    const [total, data] = await Promise.all([this.prisma.stockOpname.count({ where }), this.prisma.stockOpname.findMany({ where, include: { _count: { select: { Details: true } }, Details: { select: { ActualQty: true } } }, orderBy: { CreatedAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit })]);
    return { data: data.map(({ Details, ...item }) => ({ ...item, TotalItems: item._count.Details, CompletedItems: Details.filter((d) => d.ActualQty !== null).length })), meta: { page: query.page, limit: query.limit, totalItems: total, totalPages: Math.ceil(total / query.limit) } };
  }

  async detail(id: string) {
    const value = await this.prisma.stockOpname.findUnique({ where: { Id: id }, include: { Details: { include: { Item: true }, orderBy: { Item: { ItemCode: 'asc' } } }, Selections: { include: { Item: true } }, Attachments: true } });
    if (!value) throw new NotFoundException('Inventory counting session not found');
    return value;
  }

  start(id: string, actor: CurrentUserIdentity) {
    return withSerializableInventory(this.prisma, async (tx) => {
      const session = await tx.stockOpname.findUnique({ where: { Id: id }, include: { Selections: true } });
      if (!session) throw new NotFoundException('Inventory counting session not found');
      if (session.Status !== OpnameStatus.DRAFT) throw new ConflictException('Only DRAFT inventory counting can be started');
      const itemIds = session.Scope === OpnameScope.ALL_ACTIVE_ITEMS
        ? (await tx.inventoryItem.findMany({ where: { IsActive: true }, select: { Id: true } })).map((v) => v.Id)
        : session.Selections.map((v) => v.ItemId);
      if (!itemIds.length) throw new BadRequestException('Inventory counting has no active items');
      const overlap = await tx.stockOpnameDetail.findFirst({ where: { ItemId: { in: itemIds }, Opname: { Status: OpnameStatus.IN_PROGRESS } }, include: { Opname: true } });
      if (overlap) throw new ConflictException(`Items overlap with active inventory counting ${overlap.Opname.RecordNumber}`);
      const items = await tx.inventoryItem.findMany({ where: { Id: { in: itemIds }, IsActive: true } });
      if (items.length !== itemIds.length) throw new ConflictException('One or more selected items were archived before start');
      await tx.stockOpnameDetail.createMany({ data: items.map((item) => ({ OpnameId: id, ItemId: item.Id, SystemQty: item.CurrentBalance })) });
      await tx.stockOpname.update({ where: { Id: id }, data: { Status: OpnameStatus.IN_PROGRESS, StartedAt: new Date(), StartedBy: actor.username } });
      return tx.stockOpname.findUnique({ where: { Id: id }, include: { Details: { include: { Item: true } } } });
    });
  }

  count(id: string, detailId: number, dto: CountItemDto, actor: CurrentUserIdentity) {
    return this.saveCounts(id, [{ detailId, actualQty: dto.actualQty, notes: dto.notes }], actor);
  }
  batchCount(id: string, dto: BatchCountDto, actor: CurrentUserIdentity) {
    if (!dto.items.length || new Set(dto.items.map((v) => v.detailId)).size !== dto.items.length) throw new BadRequestException('Count rows must be non-empty and unique');
    return this.saveCounts(id, dto.items, actor);
  }
  private saveCounts(id: string, rows: Array<{ detailId: number; actualQty: number; notes?: string }>, actor: CurrentUserIdentity) {
    return withSerializableInventory(this.prisma, async (tx) => {
      const session = await tx.stockOpname.findUnique({ where: { Id: id } });
      if (!session) throw new NotFoundException('Inventory counting session not found');
      if (session.Status !== OpnameStatus.IN_PROGRESS) throw new ConflictException('Counts can only be entered while inventory counting is IN_PROGRESS');
      const details = await tx.stockOpnameDetail.findMany({ where: { OpnameId: id, Id: { in: rows.map((v) => v.detailId) } } });
      if (details.length !== rows.length) throw new NotFoundException('One or more inventory counting details were not found');
      const byId = new Map(details.map((v) => [v.Id, v]));
      for (const row of rows) {
        const detail = byId.get(row.detailId)!; const actual = new Prisma.Decimal(row.actualQty);
        await tx.stockOpnameDetail.update({ where: { Id: row.detailId }, data: { ActualQty: actual, DifferenceQty: actual.sub(detail.SystemQty), CountedAt: new Date(), CountedBy: actor.username, Notes: row.notes } });
      }
      return { updatedCount: rows.length };
    });
  }

  approve(id: string, dto: ApproveOpnameDto, actor: CurrentUserIdentity) {
    if (!dto.confirmedCheck) throw new BadRequestException('Approver must confirm physical counts and discrepancies');
    return withSerializableInventory(this.prisma, async (tx) => {
      const session = await tx.stockOpname.findUnique({ where: { Id: id }, include: { Details: true } });
      if (!session) throw new NotFoundException('Inventory counting session not found');
      if (session.Status !== OpnameStatus.IN_PROGRESS) throw new ConflictException('Only IN_PROGRESS inventory counting can be approved');
      if (session.CreatedBy === actor.username || session.Details.some((d) => d.CountedBy === actor.username)) throw new ConflictException('Maker-checker rule: creator or counter cannot approve this session');
      const incomplete = session.Details.filter((d) => d.ActualQty === null);
      if (incomplete.length) throw new ConflictException(`${incomplete.length} item(s) have not been counted`);
      for (const detail of session.Details) {
        await lockInventoryItem(tx, detail.ItemId);
        const item = await tx.inventoryItem.findUnique({ where: { Id: detail.ItemId } });
        if (!item) throw new NotFoundException('Inventory item from snapshot no longer exists');
        if (!item.CurrentBalance.equals(detail.SystemQty)) throw new ConflictException(`Balance changed after snapshot for item ${item.ItemCode}`);
        const actual = detail.ActualQty!; const difference = actual.sub(item.CurrentBalance);
        await tx.inventoryItem.update({ where: { Id: item.Id }, data: { CurrentBalance: actual, UpdatedBy: actor.username } });
        await tx.stockOpnameDetail.update({ where: { Id: detail.Id }, data: { DifferenceQty: difference } });
        await tx.inventoryLedger.create({ data: { ItemId: item.Id, TransactionType: InventoryTransactionType.STOCK_OPNAME_DIFF, ReferenceDoc: session.RecordNumber, BalanceBefore: item.CurrentBalance, QtyIn: difference.greaterThan(0) ? difference : 0, QtyOut: difference.lessThan(0) ? difference.abs() : 0, BalanceAfter: actual, CreatedBy: actor.username, Notes: `Approved stock opname ${session.RecordNumber}`, IdempotencyKey: `opname:${session.Id}:${item.Id}` } });
      }
      await tx.stockOpname.update({ where: { Id: id }, data: { Status: OpnameStatus.COMPLETED, CompletedAt: new Date(), CompletedBy: actor.username, ApprovalNotes: dto.notes } });
      return { id, recordNumber: session.RecordNumber, adjustedItems: session.Details.filter((d) => !d.ActualQty!.equals(d.SystemQty)).length };
    });
  }

  async cancel(id: string, actor: CurrentUserIdentity) {
    const session = await this.prisma.stockOpname.findUnique({ where: { Id: id } });
    if (!session) throw new NotFoundException('Inventory counting session not found');
    if (session.Status !== OpnameStatus.DRAFT && session.Status !== OpnameStatus.IN_PROGRESS) throw new ConflictException('Completed inventory counting cannot be cancelled');
    return this.prisma.stockOpname.update({ where: { Id: id }, data: { Status: OpnameStatus.CANCELLED, CompletedAt: new Date(), CompletedBy: actor.username } });
  }

  async remove(id: string) {
    const session = await this.prisma.stockOpname.findUnique({ where: { Id: id } });
    if (!session) throw new NotFoundException('Inventory counting session not found');
    if (session.Status !== OpnameStatus.DRAFT) throw new ConflictException('Only DRAFT inventory counting can be deleted');
    await this.prisma.stockOpname.delete({ where: { Id: id } });
    return { deleted: true, id };
  }

  async worksheet(id: string): Promise<Buffer> {
    const session = await this.detail(id); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Stock Opname', { views: [{ state: 'frozen', ySplit: 4 }] });
    sheet.addRow(['MTC Inventory Counting Worksheet']); sheet.addRow(['Record Number', session.RecordNumber]); sheet.addRow(['Status', session.Status]); sheet.addRow([]);
    sheet.addRow(['No', 'Item Code', 'Item Name', 'Address', 'Unit', 'System Qty', 'Actual Qty', 'Difference', 'Notes']);
    session.Details.forEach((detail, index) => sheet.addRow([index + 1, detail.Item.ItemCode, detail.Item.Name, detail.Item.AddressLocation, detail.Item.Unit, Number(detail.SystemQty), detail.ActualQty === null ? '' : Number(detail.ActualQty), detail.DifferenceQty === null ? '' : Number(detail.DifferenceQty), detail.Notes ?? '']));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async finalReport(id: string): Promise<Buffer> {
    const session = await this.detail(id); if (session.Status !== OpnameStatus.COMPLETED) throw new ConflictException('Final report is only available for completed inventory counting');
    return new Promise((resolveBuffer, reject) => { const chunks: Buffer[] = []; const pdf = new PDFDocument({ margin: 36, size: 'A4' }); pdf.on('data', (chunk: Buffer) => chunks.push(chunk)); pdf.on('end', () => resolveBuffer(Buffer.concat(chunks))); pdf.on('error', reject); pdf.fontSize(18).text('MTC Inventory Counting Final Report'); pdf.moveDown().fontSize(10).text(`Record: ${session.RecordNumber}`).text(`Completed by: ${session.CompletedBy ?? '-'}`).text(`Completed at: ${session.CompletedAt?.toISOString() ?? '-'}`); pdf.moveDown(); session.Details.forEach((d, index) => { if (pdf.y > 750) pdf.addPage(); pdf.text(`${index + 1}. ${d.Item.ItemCode} | ${d.Item.Name} | ${d.Item.AddressLocation} | System ${d.SystemQty.toString()} | Actual ${d.ActualQty?.toString() ?? '-'} | Diff ${d.DifferenceQty?.toString() ?? '-'}`); }); pdf.end(); });
  }

  async addAttachment(id: string, file: Express.Multer.File, actor: CurrentUserIdentity) {
    await this.detail(id); const detected = this.validateAttachment(file); const directory = join(this.storageRoot, id); mkdirSync(directory, { recursive: true }); const stored = `${randomUUID()}.${detected.extension}`; const path = join(directory, stored); await new Promise<void>((resolveWrite, reject) => { const stream = createWriteStream(path, { flags: 'wx' }); stream.on('error', reject); stream.on('finish', resolveWrite); stream.end(file.buffer); });
    return this.prisma.stockOpnameAttachment.create({ data: { OpnameId: id, StoredName: stored, OriginalName: file.originalname, RelativePath: `${id}/${stored}`, MimeType: detected.mimeType, Size: file.size, CreatedBy: actor.username } });
  }
  async attachments(id: string) { await this.detail(id); return this.prisma.stockOpnameAttachment.findMany({ where: { OpnameId: id }, orderBy: { CreatedAt: 'desc' } }); }
  async attachment(id: string, attachmentId: number) { const value = await this.prisma.stockOpnameAttachment.findFirst({ where: { Id: attachmentId, OpnameId: id } }); if (!value) throw new NotFoundException('Attachment not found'); const path = resolve(this.storageRoot, value.RelativePath); const relativePath = relative(this.storageRoot, path); if (relativePath.startsWith('..') || relativePath.startsWith('/') || relativePath.startsWith('\\')) throw new BadRequestException('Invalid attachment path'); return { value, buffer: await readFile(path) }; }
  async deleteAttachment(id: string, attachmentId: number) { const { value } = await this.attachment(id, attachmentId); await this.prisma.stockOpnameAttachment.delete({ where: { Id: attachmentId } }); await unlink(resolve(this.storageRoot, value.RelativePath)).catch(() => undefined); return { deleted: true, id: attachmentId }; }
  private validateAttachment(file: Express.Multer.File): { extension: 'pdf' | 'jpg' | 'png'; mimeType: string } { if (!file || file.size > 10 * 1024 * 1024) throw new BadRequestException('Attachment must be no larger than 10 MB'); const suppliedExtension = file.originalname.split('.').pop()?.toLowerCase(); const pdf = file.buffer.subarray(0, 4).toString() === '%PDF'; const jpeg = file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff; const png = file.buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])); if (pdf && suppliedExtension === 'pdf') return { extension: 'pdf', mimeType: 'application/pdf' }; if (jpeg && (suppliedExtension === 'jpg' || suppliedExtension === 'jpeg')) return { extension: 'jpg', mimeType: 'image/jpeg' }; if (png && suppliedExtension === 'png') return { extension: 'png', mimeType: 'image/png' }; throw new BadRequestException('Only matching PDF, JPEG, and PNG files are allowed'); }
}
