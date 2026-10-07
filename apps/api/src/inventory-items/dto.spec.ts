import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInventoryItemDto, UpdateInventoryItemDto } from './dto';
import { ImportItemRowDto } from '../imports/dto';

describe('Part Master fields', () => {
  const part = { name: 'Bearing', model: '6205', specification: '25 x 52 x 15 mm', addressLocation: 'A-01', unit: 'PCS', minimumStock: 0 };
  it('creates a part without a code, brand, or serial number', async () => {
    expect(await validate(plainToInstance(CreateInventoryItemDto, part))).toHaveLength(0);
    expect(await validate(plainToInstance(ImportItemRowDto, { ...part, rowNumber: 2, openingBalance: 0 }))).toHaveLength(0);
  });
  it('allows clearing optional model and specification', async () => {
    expect(await validate(plainToInstance(UpdateInventoryItemDto, { model: '', specification: '', classification: null }))).toHaveLength(0);
  });
  it('rejects specifications longer than the database column', async () => {
    const errors = await validate(plainToInstance(CreateInventoryItemDto, { ...part, specification: 'x'.repeat(1001) }));
    expect(errors.map((error) => error.property)).toContain('specification');
  });
  it('rejects removed fields with API whitelist validation', async () => {
    const errors = await validate(plainToInstance(CreateInventoryItemDto, { ...part, itemCode: 'OLD' }), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toContain('itemCode');
  });
});
