'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';

export default function OtpPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">OTP Authenticator Dashboard</h1>
          <p className="text-neutral-600">Main OTP management interface showing Google, Microsoft, GitHub, AWS authenticators</p>
        </div>

        <Card>
          <div className="space-y-4">
            <p>This is the OTP Authenticator Dashboard screen.</p>
            {/* Component implementation goes here */}
          </div>
        </Card>

        <div className="mt-6 flex gap-4">
          
          <Button onClick={() => router.push('/otp/add')}>
            Go to /otp/add
          </Button>
          <Button onClick={() => router.push('/otp/manage')}>
            Go to /otp/manage
          </Button>
        </div>
      </div>
    </div>
  );
}
