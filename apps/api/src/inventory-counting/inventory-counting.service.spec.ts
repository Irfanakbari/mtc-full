import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ExcelJS from 'exceljs';
import { Prisma } from '../generated/prisma/client';
import { OpnameScope, OpnameStatus } from '../generated/prisma/enums';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryCountingService } from './inventory-counting.service';

describe('InventoryCountingService.importCounts and importTemplate', () => {
  const actor: CurrentUserIdentity = {
    username: 'test-counter',
    name: 'Counter User',
    email: 'counter@example.com',
    permissions: ['MTC.OPNAME.UPDATE'],
    authType: 'SSO',
  };

  let service: InventoryCountingService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      stockOpname: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      stockOpnameDetail: {
        update: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(prismaMock)),
    };

    const configMock = {
      get: jest.fn().mockReturnValue('./test-storage'),
    };

    service = new InventoryCountingService(
      prismaMock as unknown as PrismaService,
      configMock as unknown as ConfigService,
    );
  });

  const createExcelFile = async (
    rows: Array<[string, any]>,
    includeHeader = true,
  ): Promise<Express.Multer.File> => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    if (includeHeader) {
      sheet.addRow(['Address Location', 'Hasil Aktual Qty']);
    }
    for (const r of rows) {
      sheet.addRow(r);
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      fieldname: 'file',
      originalname: 'counts.xlsx',
      encoding: '7bit',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
      size: buffer.length,
    } as Express.Multer.File;
  };

  it('successfully imports physical count with Column A as Address Location and Column B as Actual Qty', async () => {
    const session = {
      Id: 'opname-1',
      Status: OpnameStatus.IN_PROGRESS,
      Details: [
        {
          Id: 101,
          ItemId: 'item-1',
          SystemQty: new Prisma.Decimal(10),
          ActualQty: null,
          Item: {
            Name: 'Bearing 6204',
            AddressLocation: 'RAK-A-01',
          },
        },
        {
          Id: 102,
          ItemId: 'item-2',
          SystemQty: new Prisma.Decimal(25),
          ActualQty: null,
          Item: {
            Name: 'V-Belt B-52',
            AddressLocation: 'RAK-B-02',
          },
        },
      ],
    };

    prismaMock.stockOpname.findUnique.mockResolvedValue(session);
    prismaMock.stockOpnameDetail.update.mockResolvedValue({});

    const file = await createExcelFile([
      ['RAK-A-01', 12],
      ['RAK-B-02', 20],
      ['RAK-UNKNOWN-99', 5],
    ]);

    const result = await service.importCounts('opname-1', file, actor);

    expect(result.totalRows).toBe(3);
    expect(result.updatedCount).toBe(2);
    expect(result.unmatchedLocations).toEqual(['RAK-UNKNOWN-99']);

    expect(prismaMock.stockOpnameDetail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Id: 101 },
        data: expect.objectContaining({
          ActualQty: new Prisma.Decimal(12),
          CountedBy: 'test-counter',
        }),
      }),
    );
  });

  it('rejects import if session is not IN_PROGRESS', async () => {
    const session = {
      Id: 'opname-1',
      Status: OpnameStatus.DRAFT,
      Details: [],
    };
    prismaMock.stockOpname.findUnique.mockResolvedValue(session);

    const file = await createExcelFile([['RAK-A-01', 10]]);

    await expect(service.importCounts('opname-1', file, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects file with invalid quantity', async () => {
    const file = await createExcelFile([['RAK-A-01', -5]]);
    await expect(service.importCounts('opname-1', file, actor)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('generates an import template workbook with Column A as Address Location and Column B as Actual Qty', async () => {
    const session = {
      Id: 'opname-1',
      RecordNumber: 'STO-001',
      Scope: OpnameScope.ALL_ACTIVE_ITEMS,
      Status: OpnameStatus.IN_PROGRESS,
      Details: [
        {
          Id: 101,
          SystemQty: new Prisma.Decimal(15),
          ActualQty: null,
          Item: {
            Name: 'Bearing 6204',
            AddressLocation: 'RAK-A-01',
            Unit: 'PCS',
          },
        },
      ],
      Selections: [],
      Attachments: [],
    };

    prismaMock.stockOpname.findUnique.mockResolvedValue(session);

    const templateBuffer = await service.importTemplate('opname-1');
    expect(templateBuffer).toBeInstanceOf(Buffer);

    const book = new ExcelJS.Workbook();
    await book.xlsx.load(templateBuffer as unknown as ExcelJS.Buffer);
    const sheet = book.getWorksheet('STO Import');
    expect(sheet).toBeDefined();

    expect(sheet!.getCell('A1').value).toBe('Address Location');
    expect(sheet!.getCell('B1').value).toBe('Hasil Aktual Qty');
    expect(sheet!.getCell('A2').value).toBe('RAK-A-01');
  });
});
