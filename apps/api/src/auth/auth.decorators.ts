import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { CurrentUserIdentity } from './current-user.interface';

export const IS_PUBLIC_KEY = 'mtc:public';
export const PERMISSIONS_KEY = 'mtc:permissions';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Permission = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): CurrentUserIdentity => {
  return context.switchToHttp().getRequest<{ user: CurrentUserIdentity }>().user;
});
