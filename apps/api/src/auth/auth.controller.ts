import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './auth.decorators';
import type { CurrentUserIdentity } from './current-user.interface';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('profile')
  @ApiOperation({ summary: 'Get current application profile' })
  profile(@CurrentUser() user: CurrentUserIdentity) { return this.auth.profile(user.username); }
}
