import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Permission } from '../auth/auth.decorators';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { ApproveOpnameDto, BatchCountDto, CountItemDto, CreateOpnameDto, OpnameQueryDto } from './dto';
import { InventoryCountingService } from './inventory-counting.service';

@ApiTags('Inventory Counting') @ApiBearerAuth() @Controller('inventory-counting')
export class InventoryCountingController {
  constructor(private readonly service: InventoryCountingService) {}
  @Post() @Permission('MTC.OPNAME.CREATE') create(@Body() dto: CreateOpnameDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.create(dto, user); }
  @Get() @Permission('MTC.OPNAME.READ') list(@Query() query: OpnameQueryDto) { return this.service.list(query); }
  @Get(':id') @Permission('MTC.OPNAME.READ') detail(@Param('id') id: string) { return this.service.detail(id); }
  @Post(':id/start') @Permission('MTC.OPNAME.UPDATE') start(@Param('id') id: string, @CurrentUser() user: CurrentUserIdentity) { return this.service.start(id, user); }
  @Patch(':id/details/:detailId') @Permission('MTC.OPNAME.UPDATE') count(@Param('id') id: string, @Param('detailId', ParseIntPipe) detailId: number, @Body() dto: CountItemDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.count(id, detailId, dto, user); }
  @Patch(':id/details') @Permission('MTC.OPNAME.UPDATE') batch(@Param('id') id: string, @Body() dto: BatchCountDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.batchCount(id, dto, user); }
  @Post(':id/approve') @Permission('MTC.OPNAME.APPROVE') approve(@Param('id') id: string, @Body() dto: ApproveOpnameDto, @CurrentUser() user: CurrentUserIdentity) { return this.service.approve(id, dto, user); }
  @Post(':id/cancel') @Permission('MTC.OPNAME.CANCEL') cancel(@Param('id') id: string, @CurrentUser() user: CurrentUserIdentity) { return this.service.cancel(id, user); }
  @Delete(':id') @Permission('MTC.OPNAME.CANCEL') remove(@Param('id') id: string) { return this.service.remove(id); }
  @Get(':id/worksheet') @Permission('MTC.OPNAME.READ') @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') async worksheet(@Param('id') id: string, @Res({ passthrough: true }) response: Response) { response.setHeader('Content-Disposition', `attachment; filename="stock-opname-${id}.xlsx"`); return new StreamableFile(await this.service.worksheet(id)); }
  @Get(':id/final-report') @Permission('MTC.OPNAME.READ') @Header('Content-Type', 'application/pdf') async report(@Param('id') id: string, @Res({ passthrough: true }) response: Response) { response.setHeader('Content-Disposition', `attachment; filename="stock-opname-${id}.pdf"`); return new StreamableFile(await this.service.finalReport(id)); }
  @Post(':id/attachments') @Permission('MTC.OPNAME.UPDATE') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } })) @ApiConsumes('multipart/form-data') attachment(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: CurrentUserIdentity) { return this.service.addAttachment(id, file, user); }
  @Get(':id/attachments') @Permission('MTC.OPNAME.READ') attachments(@Param('id') id: string) { return this.service.attachments(id); }
  @Get(':id/attachments/:attachmentId') @Permission('MTC.OPNAME.READ') async download(@Param('id') id: string, @Param('attachmentId', ParseIntPipe) attachmentId: number, @Res({ passthrough: true }) response: Response) { const result = await this.service.attachment(id, attachmentId); response.setHeader('Content-Type', result.value.MimeType); response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.value.OriginalName)}`); return new StreamableFile(result.buffer); }
  @Delete(':id/attachments/:attachmentId') @Permission('MTC.OPNAME.UPDATE') deleteAttachment(@Param('id') id: string, @Param('attachmentId', ParseIntPipe) attachmentId: number) { return this.service.deleteAttachment(id, attachmentId); }
}
