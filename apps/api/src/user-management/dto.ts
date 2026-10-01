import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateUserDto { @IsOptional() @IsUUID() roleId?: string; @IsOptional() @IsBoolean() isActive?: boolean; }
export class CreateRoleDto { @IsString() @Length(1, 100) name!: string; @IsOptional() @IsString() @Length(0, 500) description?: string; @IsArray() @IsUUID('4', { each: true }) permissionIds: string[] = []; }
export class UpdateRoleDto { @IsOptional() @IsString() @Length(1, 100) name?: string; @IsOptional() @IsString() @Length(0, 500) description?: string; @IsOptional() @IsArray() @IsUUID('4', { each: true }) permissionIds?: string[]; }
export class CreatePermissionDto { @IsString() @Length(1, 120) action!: string; @IsOptional() @IsString() @Length(0, 500) description?: string; }
export class CreateApiKeyDto { @IsString() @Length(1, 120) name!: string; @IsArray() @IsString({ each: true }) permissions!: string[]; @IsOptional() @IsDateString() expiresAt?: string; }
