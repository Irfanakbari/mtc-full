import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '../auth/auth.decorators';
import { InventoryTransactionType, OpnameStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Dashboard') @ApiBearerAuth() @Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() @Permission('MTC.DASHBOARD.READ') async dashboard() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [activeItems, outOfStock, lowStockRows, balance, transactionsToday, activeOpname, recent] = await Promise.all([
      this.prisma.inventoryItem.count({ where: { IsActive: true } }),
      this.prisma.inventoryItem.count({ where: { IsActive: true, CurrentBalance: 0 } }),
      this.prisma.inventoryItem.findMany({ where: { IsActive: true }, select: { CurrentBalance: true, MinimumStock: true } }),
      this.prisma.inventoryItem.aggregate({ where: { IsActive: true }, _sum: { CurrentBalance: true } }),
      this.prisma.inventoryLedger.count({ where: { TransactionDate: { gte: start } } }),
      this.prisma.stockOpname.count({ where: { Status: OpnameStatus.IN_PROGRESS } }),
      this.prisma.inventoryLedger.findMany({ include: { Item: { select: { Model: true, Name: true } } }, orderBy: { TransactionDate: 'desc' }, take: 10 }),
    ]);
    const from = new Date(); from.setDate(from.getDate() - 6); from.setHours(0,0,0,0);
    const trendRows = await this.prisma.inventoryLedger.findMany({ where: { TransactionDate: { gte: from }, TransactionType: { in: [InventoryTransactionType.STOCK_IN, InventoryTransactionType.STOCK_OUT, InventoryTransactionType.SCRAP] } }, select: { TransactionDate: true, TransactionType: true, QtyIn: true, QtyOut: true } });
    const trends = Array.from({ length: 7 }, (_, index) => { const date = new Date(from); date.setDate(date.getDate() + index); const key = date.toISOString().slice(0,10); const rows = trendRows.filter((r) => r.TransactionDate.toISOString().slice(0,10) === key); return { date: key, stockIn: rows.filter((r) => r.TransactionType === InventoryTransactionType.STOCK_IN).reduce((sum, r) => sum + Number(r.QtyIn), 0), stockOut: rows.filter((r) => r.TransactionType === InventoryTransactionType.STOCK_OUT).reduce((sum, r) => sum + Number(r.QtyOut), 0), scrap: rows.filter((r) => r.TransactionType === InventoryTransactionType.SCRAP).reduce((sum, r) => sum + Number(r.QtyOut), 0) }; });
    return { activeItems, totalBalance: balance._sum.CurrentBalance ?? 0, lowStock: lowStockRows.filter((v) => v.CurrentBalance.lte(v.MinimumStock)).length, outOfStock, transactionsToday, activeOpname, trends, recentTransactions: recent };
  }
}
