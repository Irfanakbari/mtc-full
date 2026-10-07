import { Body, Controller, Get, Header, Headers, Post, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Permission } from '../auth/auth.decorators';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { CommitImportDto } from './dto';
import { ImportsService } from './imports.service';

@ApiTags('Imports') @ApiBearerAuth() @Controller('imports/items')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}
  @Get('template') @Permission('MTC.ITEM.IMPORT') @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') async template(@Res({ passthrough: true }) response: Response) { response.setHeader('Content-Disposition', 'attachment; filename="mtc-part-master-template.xlsx"'); return new StreamableFile(await this.service.template()); }
  @Post('preview') @Permission('MTC.ITEM.IMPORT') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } })) @ApiConsumes('multipart/form-data') preview(@UploadedFile() file: Express.Multer.File) { return this.service.preview(file); }
  @Post('commit') @Permission('MTC.ITEM.IMPORT') @ApiHeader({ name: 'Idempotency-Key', required: true }) commit(@Body() dto: CommitImportDto, @Headers('idempotency-key') key: string | undefined, @CurrentUser() user: CurrentUserIdentity) { return this.service.commit(dto, key, user); }
}
