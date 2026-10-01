import { Module } from '@nestjs/common';
import { StockTransactionsController } from './stock-transactions.controller';
import { StockTransactionsService } from './stock-transactions.service';

@Module({ controllers: [StockTransactionsController], providers: [StockTransactionsService], exports: [StockTransactionsService] })
export class StockTransactionsModule {}
