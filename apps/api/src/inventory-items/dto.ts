import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateInventoryItemDto {
  @Transform(trim) @IsString() @Length(1, 80) itemCode!: string;
  @Transform(trim) @IsString() @Length(1, 200) name!: string;
  @Transform(trim) @IsOptional() @IsString() @Length(0, 120) brand?: string;
  @Transform(trim) @IsOptional() @IsString() @Length(0, 120) model?: string;
  @Transform(trim) @IsOptional() @IsString() @Length(0, 160) serialNumber?: string;
  @Transform(trim) @IsString() @Length(1, 30) unit: string = 'PCS';
  @Transform(trim) @IsString() @Length(1, 120) addressLocation!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(Number.MAX_SAFE_INTEGER) minimumStock: number = 0;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(Number.MAX_SAFE_INTEGER) openingBalance?: number;
  @Transform(trim) @IsOptional() @IsString() @Length(0, 160) referenceDoc?: string;
  @Transform(trim) @IsOptional() @IsString() @Length(0, 1000) notes?: string;
}

export class UpdateInventoryItemDto {
  @Transform(trim) @IsOptional() @IsString() @Length(1, 80) itemCode?: string;
  @Transform(trim) @IsOptional() @IsString() @Length(1, 200) name?: string;
  @Transform(trim) @IsOptional() @IsString() @Length(0, 120) brand?: string;
  @Transform(trim) @IsOptional() @IsString() @Length(0, 120) model?: string;
  @Transform(trim) @IsOptional() @IsString() @Length(0, 160) serialNumber?: string;
  @Transform(trim) @IsOptional() @IsString() @Length(1, 30) unit?: string;
  @Transform(trim) @IsOptional() @IsString() @Length(1, 120) addressLocation?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minimumStock?: number;
}

export class ItemQueryDto {
  @IsOptional() @IsNumber() @Min(1) page = 1;
  @IsOptional() @IsNumber() @Min(1) @Max(200) limit = 50;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() lowStock?: boolean;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsIn(['ItemCode', 'Name', 'AddressLocation', 'CurrentBalance', 'CreatedAt']) sortBy = 'ItemCode';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'asc';
}

export class ArchiveItemDto { @Transform(trim) @IsString() @Length(1, 500) reason!: string; }
export class ItemIdDto { @IsUUID() id!: string; }
