import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.decorators';

@Controller()
export class AppController {
  @Public()
  @Get()
  root() { return { service: 'MTC Inventory API', version: '1.0.0' }; }
}
