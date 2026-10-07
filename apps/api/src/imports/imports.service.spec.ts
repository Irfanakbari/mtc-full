import ExcelJS from 'exceljs';
import { ImportsService } from './imports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Part Master XLSX import', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const service = new ImportsService({ inventoryItem: { findMany } } as unknown as PrismaService);
  const file = (buffer: Buffer, originalname = 'parts.xlsx') => ({ buffer, originalname, size: buffer.length }) as Express.Multer.File;
  async function workbook() {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await service.template() as unknown as ExcelJS.Buffer);
    return book;
  }
  it('downloads a valid template and reads text identifiers, numbers, and physical row numbers', async () => {
    const book = await workbook();
    const sheet = book.worksheets[0];
    expect((sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1)).toEqual(['name', 'model', 'specification', 'addressLocation', 'unit', 'openingBalance', 'minimumStock', 'referenceDoc', 'notes', 'classification']);
    sheet.getRow(3).values = ['Bearing', '00123', '25 mm', 'A-01', 'PCS', 12.5, 2, '', '', 'Consumable'];
    const result = await service.preview(file(Buffer.from(await book.xlsx.writeBuffer())));
    expect(result.valid).toBe(true);
    expect(result.rows[0]).toMatchObject({ rowNumber: 3, name: 'Bearing', model: '00123', specification: '25 mm', addressLocation: 'A-01', openingBalance: 12.5, classification: 'Consumable' });
  });
  it('reports duplicate locations and invalid quantities', async () => {
    const book = await workbook();
    book.worksheets[0].addRow(['Bearing', '', '', 'A-01', 'PCS', 1]);
    book.worksheets[0].addRow(['Bolt', '', '', 'A-01', 'PCS', -1]);
    const result = await service.preview(file(Buffer.from(await book.xlsx.writeBuffer())));
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(expect.arrayContaining(['addressLocation', 'openingBalance']));
  });
  it('rejects CSV, corrupt workbooks, and empty templates', async () => {
    await expect(service.preview(file(Buffer.from('name,addressLocation'), 'parts.csv'))).rejects.toThrow('Only XLSX');
    await expect(service.preview(file(Buffer.from('not an xlsx')))).rejects.toThrow('malformed');
    await expect(service.preview(file(await service.template()))).rejects.toThrow('at least one');
  });
  it('rejects formulas instead of silently importing cached values', async () => {
    const book = await workbook();
    book.worksheets[0].addRow(['Bearing', '', '', 'A-01', 'PCS', { formula: '1+1', result: 2 }]);
    await expect(service.preview(file(Buffer.from(await book.xlsx.writeBuffer())))).rejects.toThrow('not formulas');
  });
  it('rejects unexpected headers', async () => {
    const book = await workbook();
    book.worksheets[0].getCell('A1').value = 'itemCode';
    book.worksheets[0].addRow(['OLD', '', '', 'A-01']);
    await expect(service.preview(file(Buffer.from(await book.xlsx.writeBuffer())))).rejects.toThrow('Invalid or duplicate');
  });
});
