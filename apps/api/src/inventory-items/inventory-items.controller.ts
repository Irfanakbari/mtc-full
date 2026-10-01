import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Permission } from '../auth/auth.decorators';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { ArchiveItemDto, CreateInventoryItemDto, ItemQueryDto, UpdateInventoryItemDto } from './dto';
import { InventoryItemsService } from './inventory-items.service';

@ApiTags('Inventory Items') @ApiBearerAuth() @Controller('items')
export class InventoryItemsController {
  constructor(private readonly service: InventoryItemsService) {}
  @Post() @Permission('MTC.ITEM.CREATE') create(@Body() dto: CreateInventoryItemDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.create(dto, user); }
  @Get() @Permission('MTC.ITEM.READ') list(@Query() query: ItemQueryDto) { return this.service.findAll(query); }
  @Get('address/:address') @Permission('MTC.ITEM.READ') byAddress(@Param('address') address: string) { return this.service.findByAddress(address); }
  @Get('export') @Permission('MTC.ITEM.EXPORT') @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') async export(@Query() query: ItemQueryDto, @Res({ passthrough: true }) response: Response) { response.setHeader('Content-Disposition', 'attachment; filename="mtc-items.xlsx"'); return new StreamableFile(await this.service.export(query)); }
  @Get(':id') @Permission('MTC.ITEM.READ') detail(@Param('id') id: string) { return this.service.findOne(id); }
  @Patch(':id') @Permission('MTC.ITEM.UPDATE') update(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.update(id, dto, user); }
  @Post(':id/archive') @Permission('MTC.ITEM.ARCHIVE') archive(@Param('id') id: string, @Body() dto: ArchiveItemDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.archive(id, dto, user); }
  @Post(':id/reactivate') @Permission('MTC.ITEM.ARCHIVE') reactivate(@Param('id') id: string, @CurrentUser() user: CurrentUserIdentity) { return this.service.reactivate(id, user); }
  @Delete(':id') @Permission('MTC.ITEM.ARCHIVE') remove(@Param('id') id: string) { return this.service.remove(id); }
}
