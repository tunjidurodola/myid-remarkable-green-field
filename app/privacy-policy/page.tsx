import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: January 2026</p>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
            <p>We collect information necessary to provide our digital identity services.</p>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-2">2. Data Security</h2>
            <p>We use industry-standard encryption and security measures, including HSM protection.</p>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-2">3. Your Rights</h2>
            <p>You have the right to access, modify, and delete your personal information.</p>
          </div>
        </div>
        
        <div className="mt-8">
          <Link href="/auth/signup" className="text-blue-600 hover:underline">
            Back to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
