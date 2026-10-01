import { Module } from '@nestjs/common';
import { InventoryCountingController } from './inventory-counting.controller';
import { InventoryCountingService } from './inventory-counting.service';
@Module({ controllers: [InventoryCountingController], providers: [InventoryCountingService] })
export class InventoryCountingModule {}
