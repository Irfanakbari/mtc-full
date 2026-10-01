import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permission } from '../auth/auth.decorators';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { CreateApiKeyDto, CreatePermissionDto, CreateRoleDto, UpdateRoleDto, UpdateUserDto } from './dto';
import { UserManagementService } from './user-management.service';

@ApiTags('User Management') @ApiBearerAuth() @Controller()
export class UserManagementController {
  constructor(private readonly service: UserManagementService) {}
  @Get('users') @Permission('MTC.USER_MANAGEMENT') users() { return this.service.users(); }
  @Patch('users/:id') @Permission('MTC.USER_MANAGEMENT') updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.updateUser(id, dto, user); }
  @Get('roles') @Permission('MTC.ROLE_MANAGEMENT') roles() { return this.service.roles(); }
  @Post('roles') @Permission('MTC.ROLE_MANAGEMENT') createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.createRole(dto, user); }
  @Patch('roles/:id') @Permission('MTC.ROLE_MANAGEMENT') updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.updateRole(id, dto, user); }
  @Delete('roles/:id') @Permission('MTC.ROLE_MANAGEMENT') deleteRole(@Param('id') id: string) { return this.service.deleteRole(id); }
  @Get('permissions') @Permission('MTC.ROLE_MANAGEMENT') permissions() { return this.service.permissions(); }
  @Post('permissions') @Permission('MTC.ROLE_MANAGEMENT') createPermission(@Body() dto: CreatePermissionDto) { return this.service.createPermission(dto); }
  @Delete('permissions/:id') @Permission('MTC.ROLE_MANAGEMENT') deletePermission(@Param('id') id: string) { return this.service.deletePermission(id); }
  @Get('api-keys') @Permission('MTC.API_KEY_MANAGEMENT') apiKeys() { return this.service.apiKeys(); }
  @Post('api-keys') @Permission('MTC.API_KEY_MANAGEMENT') createApiKey(@Body() dto: CreateApiKeyDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.createApiKey(dto, user); }
  @Post('api-keys/:id/revoke') @Permission('MTC.API_KEY_MANAGEMENT') revokeApiKey(@Param('id') id: string, @CurrentUser() user: CurrentUserIdentity) { return this.service.revokeApiKey(id, user); }
}
