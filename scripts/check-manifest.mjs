import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.join(__dirname, '../../route-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

console.log('Checking manifest for missing paths...');
manifest.forEach((route, index) => {
  if (!route.path) {
    console.log(`Route ${index}: ${route.slug} - MISSING PATH`);
    console.log(JSON.stringify(route, null, 2));
  }
});

console.log(`\nTotal routes: ${manifest.length}`);
console.log(`Routes with paths: ${manifest.filter(r => r.path).length}`);
