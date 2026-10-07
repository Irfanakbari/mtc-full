import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

export class ImportItemRowDto {
  @IsNumber() @Min(1) rowNumber!: number;
  @IsString() @Length(1, 200) name!: string;
  @IsOptional() @IsString() @Length(0, 120) model?: string;
  @IsOptional() @IsString() @Length(0, 1000) specification?: string;
  @IsOptional() @IsString() classification?: string;
  @IsString() @Length(1, 30) unit!: string;
  @IsString() @Length(1, 120) addressLocation!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(Number.MAX_SAFE_INTEGER) openingBalance!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(Number.MAX_SAFE_INTEGER) minimumStock!: number;
  @IsOptional() @IsString() @Length(0, 160) referenceDoc?: string;
  @IsOptional() @IsString() @Length(0, 1000) notes?: string;
}

export class CommitImportDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ImportItemRowDto) rows!: ImportItemRowDto[];
}
