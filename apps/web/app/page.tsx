'use client';

import { useEffect } from 'react';
import { Spin, Typography } from 'antd';
import { withBasePath } from '@/lib/base-path';

export default function Login() {
  const loginPath = withBasePath('/auth/login');

  useEffect(() => {
    window.location.replace(loginPath);
  }, [loginPath]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
      <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 px-10 py-8 text-center">
        <div className="text-4xl font-bold tracking-[.28em] text-indigo-300">MTC</div>
        <Typography.Text style={{ color: '#cbd5e1' }}>Inventory Management System</Typography.Text>
      </div>
      <Spin size="large" />
      <p className="mt-4 text-sm text-slate-300">Redirecting to Vuteq SSO...</p>
      <a className="mt-3 rounded bg-indigo-600 px-4 py-2 text-sm" href={loginPath}>Continue to sign in</a>
    </main>
  );
}
