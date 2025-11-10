// NO "use client" here — this is a Server Component wrapper
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import UploadPageClient from './UploadPageClient';

export default function Page() {
  return <UploadPageClient />;
}
