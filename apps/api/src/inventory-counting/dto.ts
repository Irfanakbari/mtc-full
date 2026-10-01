import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';
import { OpnameScope, OpnameStatus } from '../generated/prisma/enums';

export class CreateOpnameDto {
  @IsEnum(OpnameScope) scope!: OpnameScope;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) itemIds?: string[];
  @IsOptional() @IsString() @Length(0, 1000) notes?: string;
}
export class CountItemDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) actualQty!: number;
  @IsOptional() @IsString() @Length(0, 1000) notes?: string;
}
export class BatchCountRowDto extends CountItemDto { @IsNumber() @Min(1) detailId!: number; }
export class BatchCountDto { @IsArray() @ValidateNested({ each: true }) @Type(() => BatchCountRowDto) items!: BatchCountRowDto[]; }
export class ApproveOpnameDto { @IsBoolean() confirmedCheck!: boolean; @IsOptional() @IsString() @Length(0, 1000) notes?: string; }
export class OpnameQueryDto {
  @Type(() => Number) @IsOptional() @IsNumber() @Min(1) page: number = 1;
  @Type(() => Number) @IsOptional() @IsNumber() @Min(1) @Max(200) limit: number = 50;
  @IsOptional() @IsEnum(OpnameStatus) status?: OpnameStatus;
  @IsOptional() @IsString() search?: string;
}
