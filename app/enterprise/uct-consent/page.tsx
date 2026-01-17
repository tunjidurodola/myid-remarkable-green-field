'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';

export default function EnterpriseUctConsentPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">UCT Consent - Data Selection</h1>
          <p className="text-neutral-600">Data sharing consent</p>
        </div>

        <Card>
          <div className="space-y-4">
            <p>This is the UCT Consent - Data Selection screen.</p>
            {/* Component implementation goes here */}
          </div>
        </Card>

        <div className="mt-6 flex gap-4">
          
          <Button onClick={() => router.push('/enterprise/uct-generated')}>
            Go to /enterprise/uct-generated
          </Button>
        </div>
      </div>
    </div>
  );
}
