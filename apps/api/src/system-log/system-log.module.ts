import { Module } from '@nestjs/common';
import { SystemLogController } from './system-log.controller';
@Module({ controllers: [SystemLogController] })
export class SystemLogModule {}
