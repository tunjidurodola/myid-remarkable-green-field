import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.join(__dirname, '../../route-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const appDir = path.join(__dirname, '../app');

// Convert slug to path
function slugToPath(slug) {
  // Special cases
  if (slug === 'splash') return '/';

  // Convert slugs like "auth-signin" to "/auth/signin"
  // Convert "onboarding-step-1" to "/onboarding/step-1"
  // Convert "settings-language" to "/settings/language"
  const parts = slug.split('-');

  // Group by main category
  if (parts[0] === 'onboarding') {
    // onboarding-step-X -> /onboarding/step-X
    return `/onboarding/${parts.slice(1).join('-')}`;
  } else if (parts[0] === 'auth') {
    // auth-signin -> /auth/signin
    return `/auth/${parts.slice(1).join('-')}`;
  } else if (parts[0] === 'security') {
    // security-qes -> /security/qes
    return `/security/${parts.slice(1).join('-')}`;
  } else if (parts[0] === 'settings') {
    // settings-language -> /settings/language
    return `/settings/${parts.slice(1).join('-')}`;
  } else if (parts[0] === 'trust' && parts[1] === 'email') {
    // trust-email-create -> /trust-email/create
    return `/trust-email/${parts.slice(2).join('-')}`;
  } else if (parts[0] === 'enterprise') {
    // enterprise-uct-scanner -> /enterprise/uct-scanner
    return `/enterprise/${parts.slice(1).join('-')}`;
  } else if (parts[0] === 'otp') {
    // otp-add -> /otp/add
    if (parts.length === 1) return '/otp';
    return `/otp/${parts.slice(1).join('-')}`;
  } else if (slug === 'verification-success') {
    return '/verification-success';
  } else if (slug === 'profile') {
    return '/profile';
  } else if (slug === 'dashboard') {
    return '/dashboard';
  } else if (slug === 'scanner') {
    return '/scanner';
  } else if (slug === 'sharing') {
    return '/sharing';
  } else if (slug === 'subscription') {
    return '/subscription';
  } else if (slug === 'legal') {
    return '/legal';
  } else {
    // Default: join with /
    return `/${slug}`;
  }
}

const routeTemplates = {
  step: (route, routePath) => `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepperShell } from '@/components/organisms/StepperShell';
import { Input } from '@/components/atoms/Input';
import { Button } from '@/components/atoms/Button';

export default function ${route.slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    setLoading(true);
    setTimeout(() => {
      ${route.navTo && route.navTo.length > 0 ? `router.push('${route.navTo[0]}');` : ''}
    }, 500);
  };

  const handleBack = () => {
    ${route.navFrom && route.navFrom.length > 0 ? `router.push('${route.navFrom[0]}');` : 'router.back();'}
  };

  return (
    <StepperShell
      currentStep={${route.index}}
      totalSteps={9}
      title="${route.title}"
      description="${route.notes}"
      onNext={handleNext}
      onBack={handleBack}
      loading={loading}
    >
      <div className="space-y-4">
        <p className="text-neutral-600">${route.notes}</p>
        {/* Component implementation goes here */}
      </div>
    </StepperShell>
  );
}
`,

  screen: (route, routePath) => `'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';

export default function ${route.slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Page() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">${route.title}</h1>
          <p className="text-neutral-600">${route.notes}</p>
        </div>

        <Card>
          <div className="space-y-4">
            <p>This is the ${route.title} screen.</p>
            {/* Component implementation goes here */}
          </div>
        </Card>

        <div className="mt-6 flex gap-4">
          ${route.navTo && route.navTo.length > 0 ? route.navTo.map(nav => `
          <Button onClick={() => router.push('${nav}')}>
            Go to ${nav}
          </Button>`).join('') : ''}
        </div>
      </div>
    </div>
  );
}
`,
};

function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

function generateRoute(route) {
  const routePath = route.path || slugToPath(route.slug);

  // Skip splash (already done as /)
  if (routePath === '/' || route.slug === 'splash') {
    console.log(`Skipping splash route (already implemented as /)`);
    return;
  }

  // Skip manually created auth routes
  if (routePath === '/auth/signin' || routePath === '/auth/signup') {
    console.log(`Skipping manual route: ${routePath}`);
    return;
  }

  const filePath = path.join(appDir, routePath, 'page.tsx');

  // Skip if already exists
  if (fs.existsSync(filePath)) {
    console.log(`Route already exists: ${routePath}`);
    return;
  }

  ensureDirectoryExists(filePath);

  const template = route.type === 'step' ? routeTemplates.step : routeTemplates.screen;
  const content = template(route, routePath);

  fs.writeFileSync(filePath, content);
  console.log(`Generated: ${routePath}`);
}

// Generate all routes
console.log('Generating all routes from manifest...');
let generated = 0;
let skipped = 0;

manifest.forEach((route) => {
  try {
    const routePath = route.path || slugToPath(route.slug);
    if (fs.existsSync(path.join(appDir, routePath, 'page.tsx')) || routePath === '/') {
      skipped++;
    } else {
      generateRoute(route);
      generated++;
    }
  } catch (error) {
    console.error(`Error generating route ${route.slug}:`, error.message);
  }
});

console.log(`\nComplete!`);
console.log(`Generated: ${generated} routes`);
console.log(`Skipped: ${skipped} routes (already exist)`);
console.log(`Total routes in manifest: ${manifest.length}`);
