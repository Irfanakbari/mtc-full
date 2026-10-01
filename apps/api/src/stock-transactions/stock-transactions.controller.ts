import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permission } from '../auth/auth.decorators';
import type { CurrentUserIdentity } from '../auth/current-user.interface';
import { InventoryTransactionType } from '../generated/prisma/enums';
import { LedgerQueryDto, StockMutationDto } from './dto';
import { StockTransactionsService } from './stock-transactions.service';

@ApiTags('Stock Transactions') @ApiBearerAuth() @Controller('stock')
export class StockTransactionsController {
  constructor(private readonly service: StockTransactionsService) {}
  @Post('in') @Permission('MTC.STOCK.IN') @ApiHeader({ name: 'Idempotency-Key', required: true }) stockIn(@Body() dto: StockMutationDto, @Headers('idempotency-key') key: string | undefined, @CurrentUser() user: CurrentUserIdentity) { return this.service.mutate(InventoryTransactionType.STOCK_IN, dto, key, user); }
  @Post('out') @Permission('MTC.STOCK.OUT') @ApiHeader({ name: 'Idempotency-Key', required: true }) stockOut(@Body() dto: StockMutationDto, @Headers('idempotency-key') key: string | undefined, @CurrentUser() user: CurrentUserIdentity) { return this.service.mutate(InventoryTransactionType.STOCK_OUT, dto, key, user); }
  @Post('scrap') @Permission('MTC.STOCK.SCRAP') @ApiHeader({ name: 'Idempotency-Key', required: true }) scrap(@Body() dto: StockMutationDto, @Headers('idempotency-key') key: string | undefined, @CurrentUser() user: CurrentUserIdentity) { return this.service.mutate(InventoryTransactionType.SCRAP, dto, key, user); }
  @Get('transactions') @Permission('MTC.STOCK.READ') transactions(@Query() query: LedgerQueryDto) { return this.service.listTransactions(query); }
  @Get('ledger') @Permission('MTC.STOCK.READ') ledger(@Query() query: LedgerQueryDto) { return this.service.list(query); }
  @Get('ledger/:id') @Permission('MTC.STOCK.READ') detail(@Param('id') id: string) { return this.service.detail(id); }
  @Get('reconciliation') @Permission('MTC.SYSTEM_LOG_READ') reconcile(@Query('itemId') itemId?: string) { return this.service.reconcile(itemId); }
}
