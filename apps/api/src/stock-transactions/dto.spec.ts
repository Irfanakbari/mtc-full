import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StockMutationDto } from './dto';

describe('StockMutationDto', () => {
  it('accepts a positive quantity with at most two decimals', async () => {
    const dto = plainToInstance(StockMutationDto, { itemId: '4d2f18b7-97fc-46f1-895e-43371d7d2f88', quantity: 1.25, referenceDoc: 'MTC-001' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([0, -1, 1.234])('rejects invalid quantity %s', async (quantity) => {
    const dto = plainToInstance(StockMutationDto, { itemId: '4d2f18b7-97fc-46f1-895e-43371d7d2f88', quantity, referenceDoc: 'MTC-001' });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
