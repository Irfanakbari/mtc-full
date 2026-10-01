import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DualAuthGuard } from './dual-auth.guard';
import { SsoAuthService } from './sso-auth.service';

@Module({ controllers: [AuthController], providers: [AuthService, SsoAuthService, ApiKeyService, DualAuthGuard], exports: [DualAuthGuard, SsoAuthService, ApiKeyService] })
export class AuthModule {}
