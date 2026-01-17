# myID.africa PWA - Quick Start

## Fix Applied ✅

The Next.js configuration error has been fixed. The `withPWA` wrapper is now correctly implemented.

## Start Development Server

```bash
cd /perform1/srv/work/myid-app

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

Expected output:
```
  ▲ Next.js 14.2.35
  - Local:        http://localhost:3000

 ✓ Starting...
> [PWA] PWA support is disabled (development mode)
 ✓ Ready in 2.5s
```

PWA is **intentionally disabled** in development mode for faster hot reloading.

## Test Production Mode

### Option 1: Standard Node.js Server

```bash
# Build for production
npm run build

# Start production server
npm start
```

Expected output:
```
> [PWA] PWA support is enabled
> [PWA] Service worker registered
  ▲ Next.js 14.2.35
  - Local:        http://localhost:3000
```

### Option 2: PM2 Process Manager (Recommended for Production)

PM2 keeps the app running after you log out and provides monitoring tools.

```bash
# Build for production
npm run build

# Start with PM2 (both PWA and HSM backend)
npm run pm2:start

# Check status
npm run pm2:status

# View logs
npm run pm2:logs

# Monitor in real-time
npm run pm2:monit

# Stop when done
npm run pm2:stop
```

**Benefits:**
- App stays running after terminal logout
- Automatic restart on crashes
- Built-in monitoring and log management
- Zero-downtime reloads

**See [PM2_GUIDE.md](./PM2_GUIDE.md) for complete documentation.**

PWA features (service worker, offline support) are **enabled in production mode**.

## What Was Fixed

### Before (Error)
```javascript
export default withPWA({
  dest: 'public',
  ...nextConfig,  // ❌ Wrong: PWA options and Next config mixed
});
```

Error: `Unrecognized key(s) in object: '0', '1', '2', ...`

### After (Fixed)
```javascript
const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  // ... PWA options
});

export default withPWA(nextConfig);  // ✅ Correct: Separated config
```

## Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| PWA Enabled | ❌ No | ✅ Yes |
| Service Worker | ❌ Disabled | ✅ Registered |
| Offline Support | ❌ No | ✅ Yes |
| Hot Reload | ✅ Fast | N/A |
| Cache Strategy | None | Full caching |

## Verify Setup

1. **Development Mode**:
   ```bash
   npm run dev
   # Visit http://localhost:3000
   # Should see splash screen → signin
   ```

2. **Production Mode**:
   ```bash
   npm run build && npm start
   # Visit http://localhost:3000
   # Install PWA from browser
   # Test offline mode
   ```

3. **Route Audit**:
   ```bash
   npm run audit:routes
   # Should show: 47/47 routes (100%)
   ```

## Available Commands

```bash
npm run dev              # Development server
npm run build            # Production build
npm start                # Production server
npm run build:standalone # Standalone build (Docker)
npm test                 # Run E2E tests
npm run audit:routes     # Validate routes
npm run lint             # Check code quality
npm run type-check       # TypeScript validation
npm run clean            # Clean build artifacts
```

## Test the PWA

### In Browser
1. Start production server: `npm run build && npm start`
2. Open Chrome/Edge DevTools → Application → Service Workers
3. Verify service worker is registered
4. Check Cache Storage for cached assets
5. Go offline (DevTools → Network → Offline)
6. Reload page - should still work!

### Install as App
1. Visit http://localhost:3000 in Chrome/Edge
2. Look for install icon in address bar
3. Click "Install myID.africa"
4. App opens in standalone window

## Environment Setup

Create `.env.local` for development:
```bash
cp .env.local.example .env.local
```

Edit as needed:
```env
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_HSM_URL=http://172.27.127.129:3001
```

## Next Steps

1. ✅ Fix applied - development server works
2. ✅ Production build works with PWA enabled
3. ✅ All 47 routes implemented
4. ✅ Tests passing

Ready for deployment! See `DEPLOYMENT.md` for production deployment guide.

## Troubleshooting

### Port already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Module not found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Build fails
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### HSM backend not accessible
```bash
# Test connectivity
telnet 172.27.127.129 3001

# Start backend if needed
cd backend
npm install
npm start
```

## Success Indicators

✅ Dev server starts without errors
✅ No "Unrecognized key(s)" warning
✅ Production build completes
✅ Service worker registers in production
✅ All routes accessible
✅ Route audit passes (47/47)

You're ready to go! 🚀
