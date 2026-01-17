import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: January 2026</p>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
            <p>By accessing and using myID.africa, you accept and agree to be bound by these Terms of Service.</p>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-2">2. Service Description</h2>
            <p>myID.africa provides digital identity management services using secure, standards-compliant credentials.</p>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-2">3. User Responsibilities</h2>
            <p>You are responsible for maintaining the security of your account and credentials.</p>
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
