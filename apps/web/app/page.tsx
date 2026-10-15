/*By Irfan Akbari Vuteq Indonesia - 2026-09-15*/

'use client';

import { useVuteqSso } from '@vuteq/sso-client-react/react';
import { Spin, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { withBasePath } from '@/lib/base-path';

const APP_VERSION = '1.0.0';

export default function Home() {
  const router = useRouter();
  const { session, loading } = useVuteqSso();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      window.location.replace(withBasePath('/auth/login'));
      return;
    }
    const status = (session.attributes as { AccessStatus?: string } | undefined)?.AccessStatus;
    if (status === 'PENDING') router.replace('/auth/pending-account');
    else if (status === 'ACTIVE') router.replace('/apps');
    else router.replace('/auth/error');
  }, [loading, router, session]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <Spin size="large" />
        <Typography.Title level={4} className="mt-5! mb-1!">
          Connecting to Vuteq SSO
        </Typography.Title>
        <Typography.Text type="secondary">MTC v{APP_VERSION}</Typography.Text>
      </div>
    </main>
  );
}
