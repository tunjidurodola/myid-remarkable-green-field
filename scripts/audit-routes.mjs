import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.join(__dirname, '../../route-manifest.json');
const appDir = path.join(__dirname, '../app');

// Load manifest
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Convert slug to path
function slugToPath(slug) {
  if (slug === 'splash') return '/';

  const parts = slug.split('-');

  if (parts[0] === 'onboarding') {
    return `/onboarding/${parts.slice(1).join('-')}`;
  } else if (parts[0] === 'auth') {
    return `/auth/${parts.slice(1).join('-')}`;
  } else if (parts[0] === 'security') {
    return `/security/${parts.slice(1).join('-')}`;
  } else if (parts[0] === 'settings') {
    return `/settings/${parts.slice(1).join('-')}`;
  } else if (parts[0] === 'trust' && parts[1] === 'email') {
    return `/trust-email/${parts.slice(2).join('-')}`;
  } else if (parts[0] === 'enterprise') {
    return `/enterprise/${parts.slice(1).join('-')}`;
  } else if (parts[0] === 'otp') {
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
    return `/${slug}`;
  }
}

// Check if route exists
function routeExists(routePath) {
  const filePath = path.join(appDir, routePath, 'page.tsx');
  return fs.existsSync(filePath);
}

// Find all page.tsx files in app directory
function findAllRoutes(dir, base = '') {
  const routes = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      routes.push(...findAllRoutes(fullPath, path.join(base, item)));
    } else if (item === 'page.tsx') {
      routes.push(base || '/');
    }
  }

  return routes;
}

console.log('='.repeat(80));
console.log('ROUTE AUDIT - myID.africa PWA');
console.log('='.repeat(80));
console.log();

// Check manifest routes
console.log('📋 MANIFEST ROUTES');
console.log('-'.repeat(80));

let manifestCount = 0;
let missingCount = 0;
const missingRoutes = [];

for (const route of manifest) {
  const routePath = route.path || slugToPath(route.slug);
  manifestCount++;

  if (routeExists(routePath)) {
    console.log(`✅ ${routePath.padEnd(40)} (${route.title})`);
  } else {
    console.log(`❌ ${routePath.padEnd(40)} (${route.title}) - MISSING`);
    missingRoutes.push({ path: routePath, title: route.title });
    missingCount++;
  }
}

console.log();
console.log('📁 IMPLEMENTED ROUTES');
console.log('-'.repeat(80));

const implementedRoutes = findAllRoutes(appDir);
const implementedCount = implementedRoutes.length;

implementedRoutes.sort().forEach(route => {
  console.log(`   ${route}`);
});

console.log();
console.log('📊 SUMMARY');
console.log('-'.repeat(80));
console.log(`Total routes in manifest:     ${manifestCount}`);
console.log(`Total routes implemented:     ${implementedCount}`);
console.log(`Missing routes:               ${missingCount}`);
console.log(`Implementation rate:          ${Math.round((manifestCount - missingCount) / manifestCount * 100)}%`);

if (missingCount > 0) {
  console.log();
  console.log('⚠️  MISSING ROUTES:');
  missingRoutes.forEach(({ path, title }) => {
    console.log(`   ${path} - ${title}`);
  });
  console.log();
  process.exit(1);
} else {
  console.log();
  console.log('✅ All routes from manifest are implemented!');
  console.log();
  process.exit(0);
}
