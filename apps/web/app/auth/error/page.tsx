'use client';

import { Button, Result } from 'antd';
import { withBasePath } from '@/lib/base-path';

export default function AuthError() {
  return (
    <Result
      status="error"
      title="Sign-in failed"
      subTitle="Vuteq SSO could not complete the sign-in request. Please try again or contact support."
      extra={<Button type="primary" href={withBasePath('/auth/login')}>Try again</Button>}
    />
  );
}
