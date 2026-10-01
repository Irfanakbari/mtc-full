import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { InventoryTransactionType } from '../generated/prisma/enums';

export class StockMutationDto {
  @IsUUID() itemId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(Number.MAX_SAFE_INTEGER) quantity!: number;
  @IsString() @Length(1, 160) referenceDoc!: string;
  @IsOptional() @IsString() @Length(0, 1000) notes?: string;
}

export class LedgerQueryDto {
  @Type(() => Number) @IsOptional() @IsNumber() @Min(1) page: number = 1;
  @Type(() => Number) @IsOptional() @IsNumber() @Min(1) @Max(200) limit: number = 50;
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(InventoryTransactionType) transactionType?: InventoryTransactionType;
  @IsOptional() @IsString() actor?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
