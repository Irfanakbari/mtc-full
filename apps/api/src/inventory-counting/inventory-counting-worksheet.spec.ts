import ExcelJS from 'exceljs';
import { OpnameScope, OpnameStatus } from '../generated/prisma/enums';
import {
  buildInventoryCountingWorksheet,
  type WorksheetRowData,
  type WorksheetSessionData,
} from './inventory-counting-worksheet.builder';

describe('Inventory Counting Worksheet Builder', () => {
  const mockSession: WorksheetSessionData = {
    Id: 'opname-uuid-1',
    RecordNumber: 'STO-20261022-001',
    Scope: OpnameScope.ALL_ACTIVE_ITEMS,
    Status: OpnameStatus.IN_PROGRESS,
    Notes: 'Semester 2 General Counting',
    CreatedAt: new Date('2026-10-22T08:00:00Z'),
    CreatedBy: 'auditor1',
    StartedAt: new Date('2026-10-22T09:00:00Z'),
    StartedBy: 'counter1',
    CompletedAt: null,
    CompletedBy: null,
    ApprovalNotes: null,
  };

  const mockRows: WorksheetRowData[] = [
    {
      item: {
        Name: 'Ball Bearing 6204',
        Model: '6204-2RS',
        Specification: 'Deep Groove Ball Bearing 20x47x14mm',
        Classification: 'BEARING',
        Unit: 'PCS',
        AddressLocation: 'RAK-A-01-01',
      },
      systemQty: 50,
      actualQty: 48,
      differenceQty: -2,
      notes: '2 damaged units quarantined',
    },
    {
      item: {
        Name: 'V-Belt Mitsuboshi A-42',
        Model: 'A-42',
        Specification: 'Standard Industrial V-Belt',
        Classification: 'BELT',
        Unit: 'PCS',
        AddressLocation: 'RAK-B-02-03',
      },
      systemQty: 20,
      actualQty: null,
      differenceQty: null,
      notes: null,
    },
  ];

  it('should generate a valid Excel spreadsheet buffer with proper print and page setup', async () => {
    const buffer = await buildInventoryCountingWorksheet(mockSession, mockRows);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const sheet = workbook.getWorksheet('Stock Opname');
    expect(sheet).toBeDefined();

    // Verify Page Setup for printing
    expect(sheet!.pageSetup.orientation).toBe('landscape');
    expect(sheet!.pageSetup.paperSize).toBe(9); // A4
    expect(sheet!.pageSetup.fitToWidth).toBe(1);
    expect(sheet!.pageSetup.fitToHeight).toBe(0);
    expect(sheet!.pageSetup.printTitlesRow).toBe('7:7');
    expect(sheet!.pageSetup.showGridLines).toBe(true);

    // Verify Title & Company Header
    expect(sheet!.getCell('A1').value).toContain('PT VUTEQ INDONESIA');
    expect(sheet!.getCell('A2').value).toContain('LEMBAR KERJA STOCK OPNAME');

    // Verify Metadata
    expect(sheet!.getCell('B4').value).toBe('STO-20261022-001');
    expect(sheet!.getCell('I4').value).toBe('IN_PROGRESS');
    expect(sheet!.getCell('L4').value).toBe('2 Item');
    expect(sheet!.getCell('F5').value).toBe('auditor1');
    expect(sheet!.getCell('L5').value).toBe('Semester 2 General Counting');

    // Verify Table Headers on Row 7
    expect(sheet!.getCell('A7').value).toBe('NO');
    expect(sheet!.getCell('B7').value).toBe('LOKASI / RAK');
    expect(sheet!.getCell('C7').value).toBe('NAMA BARANG / ITEM NAME');
    expect(sheet!.getCell('H7').value).toBe('QTY SISTEM');
    expect(sheet!.getCell('I7').value).toBe('HASIL FISIK');
    expect(sheet!.getCell('J7').value).toBe('SELISIH');
    expect(sheet!.getCell('K7').value).toBe('CEK');

    // Verify Row 8 (Item 1 with counted data)
    expect(sheet!.getCell('A8').value).toBe(1);
    expect(sheet!.getCell('B8').value).toBe('RAK-A-01-01');
    expect(sheet!.getCell('C8').value).toBe('Ball Bearing 6204');
    expect(sheet!.getCell('H8').value).toBe(50);
    expect(sheet!.getCell('I8').value).toBe(48);
    expect((sheet!.getCell('J8').value as { formula: string }).formula).toBe('IF(ISBLANK(I8),"",I8-H8)');
    expect(sheet!.getCell('K8').value).toBe('✓');
    expect(sheet!.getCell('L8').value).toBe('2 damaged units quarantined');

    // Verify Row 9 (Item 2 with uncounted data)
    expect(sheet!.getCell('A9').value).toBe(2);
    expect(sheet!.getCell('B9').value).toBe('RAK-B-02-03');
    expect(sheet!.getCell('H9').value).toBe(20);
    expect(sheet!.getCell('I9').value).toBeNull();
    expect(sheet!.getCell('K9').value).toBe('[  ]');

    // Verify Total / Summary Row (Row 10)
    expect(sheet!.getCell('A10').value).toBe('TOTAL (2 ITEMS)');
    expect((sheet!.getCell('H10').value as { formula: string }).formula).toBe('SUM(H8:H9)');

    // Verify Signatures Section
    const foundCountedBy = sheet!.getRow(12).getCell(2).value;
    expect(foundCountedBy).toBe('PETUGAS PENGHITUNG / COUNTED BY');
  });

  it('should handle empty rows gracefully', async () => {
    const buffer = await buildInventoryCountingWorksheet(mockSession, []);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const sheet = workbook.getWorksheet('Stock Opname');
    expect(sheet).toBeDefined();
    expect(sheet!.getCell('A8').value).toContain('Tidak ada item');
  });
});
