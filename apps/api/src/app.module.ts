import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DualAuthGuard } from './auth/dual-auth.guard';
import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { RequestCorrelationMiddleware } from './common/request-correlation.middleware';
import { ResponseInterceptor } from './common/response.interceptor';
import { ProcessLogInterceptor } from './common/process-log.interceptor';
import { validateEnvironment } from './config/environment.validation';
import { PrismaModule } from './prisma/prisma.module';
import { InventoryItemsModule } from './inventory-items/inventory-items.module';
import { StockTransactionsModule } from './stock-transactions/stock-transactions.module';
import { ImportsModule } from './imports/imports.module';
import { InventoryCountingModule } from './inventory-counting/inventory-counting.module';
import { UserManagementModule } from './user-management/user-management.module';
import { SystemLogModule } from './system-log/system-log.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), ThrottlerModule.forRoot([{ ttl: 60000, limit: 500 }]), PrismaModule, CommonModule, AuthModule, InventoryItemsModule, StockTransactionsModule, ImportsModule, InventoryCountingModule, UserManagementModule, SystemLogModule, DashboardModule, HealthModule],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: DualAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ProcessLogInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void { consumer.apply(RequestCorrelationMiddleware).forRoutes('*'); }
}
