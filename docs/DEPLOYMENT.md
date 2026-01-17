# myID.africa PWA - Deployment Guide

## Quick Start

### Development Mode
```bash
npm install
npm run dev
# → http://localhost:3000
```

### Production Mode
```bash
# Build for production
npm run build

# Start production server
npm start
# → http://localhost:3000
```

---

## Configuration

### Environment Files

Create appropriate `.env` files:

**Development** (`.env.local`):
```bash
cp .env.local.example .env.local
# Edit with your local settings
```

**Production** (`.env.production`):
```bash
cp .env.production.example .env.production
# Edit with your production settings
```

### Key Configuration

| Variable | Development | Production |
|----------|-------------|------------|
| `NODE_ENV` | development | production |
| `NEXT_PUBLIC_API_URL` | http://localhost:3001 | https://api.myid.africa |
| `NEXT_PUBLIC_HSM_URL` | http://172.27.127.129:3001 | https://hsm.myid.africa |
| `NEXT_PUBLIC_API_KEY` | dev-key | production-key |

---

## Development

### Start Development Server
```bash
npm run dev
```

Features:
- Hot Module Replacement (HMR)
- Fast Refresh
- PWA disabled (for faster reloads)
- Source maps enabled
- Type checking on save

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

---

## Production Build

### Standard Build
```bash
npm run build
```

Creates optimized production build in `.next/` directory.

### Standalone Build
```bash
npm run build:standalone
```

Creates self-contained build in `.next/standalone/` with all dependencies included. Perfect for Docker deployment.

### Analyze Bundle Size
```bash
npm run build:analyze
```

Generates bundle analysis to optimize package sizes.

---

## Production Deployment

### Option 1: Node.js Server (Standard)

```bash
# Build
npm run build

# Start production server
npm start
```

### Option 2: PM2 Process Manager (Recommended)

PM2 keeps your application running after you log out and provides monitoring tools.

**First-time setup:**
```bash
# Install PM2 globally (optional, already in devDependencies)
npm install -g pm2

# Build the application
npm run build

# Start both PWA and HSM backend with PM2
npm run pm2:start
```

**PM2 Commands:**
```bash
# View status of all processes
npm run pm2:status

# View logs (all processes)
npm run pm2:logs

# View logs for specific process
pm2 logs myid-pwa
pm2 logs myid-hsm

# Monitor processes (interactive)
npm run pm2:monit

# Restart processes
npm run pm2:restart

# Reload processes (zero-downtime)
npm run pm2:reload

# Stop processes
npm run pm2:stop

# Delete processes from PM2
npm run pm2:delete
```

**PM2 Web Interface:**
```bash
# Start PM2 web monitoring on http://localhost:9615
npm run pm2:web
```

Access from remote machine:
```bash
# On server: Start PM2 web with custom host/port
pm2 web --host 0.0.0.0 --port 9615

# From your local machine:
# Create SSH tunnel
ssh -L 9615:localhost:9615 user@nv2

# Open http://localhost:9615 in your browser
```

**Startup on Boot:**
```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Resurrect processes after reboot
pm2 resurrect
```

**Log Management:**
```bash
# View logs location
pm2 show myid-pwa

# Flush logs
pm2 flush

# Install log rotation
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Option 3: Docker

**Dockerfile** (create this):
```dockerfile
FROM node:22-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t myid-pwa .
docker run -p 3000:3000 myid-pwa
```

### Option 4: Docker Compose

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  pwa:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://api.myid.africa
      - NEXT_PUBLIC_HSM_URL=https://hsm.myid.africa
    restart: unless-stopped
    networks:
      - myid-network

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - HSM_HOST=172.27.127.129
      - HSM_PORT=3001
    restart: unless-stopped
    networks:
      - myid-network

networks:
  myid-network:
    driver: bridge
```

Run:
```bash
docker-compose up -d
```

---

## Testing

### Run All Tests
```bash
npm test
```

### Interactive Mode
```bash
npm run test:ui
```

### Debug Mode
```bash
npm run test:debug
```

### Headed Mode (visible browser)
```bash
npm run test:headed
```

### Route Validation
```bash
npm run audit:routes
```

Should output:
```
✅ All routes from manifest are implemented!
Total routes: 47/47 (100%)
```

---

## HSM Backend Deployment

### Development
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with HSM credentials
npm start
```

### Production
```bash
cd backend
npm install
NODE_ENV=production npm start
```

### With PM2
```bash
cd backend
pm2 start server.mjs --name "myid-hsm" --env production
```

### Docker
```bash
cd backend
docker build -t myid-hsm .
docker run -p 3001:3001 \
  -e HSM_HOST=172.27.127.129 \
  -e HSM_PIN=$HSM_PIN \
  myid-hsm
```

---

## Performance Optimization

### Enable Compression
Use nginx or another reverse proxy:

```nginx
server {
    listen 80;
    server_name myid.africa;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Enable gzip
        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    }
}
```

### CDN Configuration
For static assets, configure CDN headers:
- Cache-Control: public, max-age=31536000, immutable (for /_next/static/*)
- Cache-Control: public, max-age=3600 (for images)

---

## Monitoring

### Health Check Endpoint
Create `app/api/health/route.ts`:
```typescript
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
}
```

Access: `http://localhost:3000/api/health`

### Logs
```bash
# PM2 logs
pm2 logs myid-pwa

# Docker logs
docker logs myid-pwa

# System logs
journalctl -u myid-pwa -f
```

---

## Troubleshooting

### Issue: PWA not registering
**Solution**: Ensure you're using HTTPS or localhost. PWA requires secure context.

### Issue: Service worker not updating
**Solution**: Hard refresh (Ctrl+Shift+R) or clear service worker in DevTools.

### Issue: Build fails with memory error
**Solution**: Increase Node.js memory:
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

### Issue: HSM connection fails
**Solution**: Verify network connectivity to 172.27.127.129:
```bash
telnet 172.27.127.129 3001
```

### Issue: Routes not found (404)
**Solution**: Run audit script to verify:
```bash
npm run audit:routes
```

---

## Security Checklist

- [ ] Environment variables secured (not in git)
- [ ] API keys rotated from defaults
- [ ] HTTPS enabled in production
- [ ] HSM PIN protected
- [ ] Rate limiting enabled
- [ ] CORS configured properly
- [ ] Security headers set (CSP, HSTS, etc.)
- [ ] Dependencies audited (`npm audit`)
- [ ] Secrets stored in secure vault (not .env files)

---

## Production Checklist

- [ ] Environment variables configured
- [ ] Build completed successfully
- [ ] All tests passing
- [ ] Route audit passing (47/47)
- [ ] HSM backend running and accessible
- [ ] SSL certificates installed
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Rollback plan documented
- [ ] Load testing completed
- [ ] Performance benchmarks met

---

## Rollback Procedure

1. Stop current deployment:
   ```bash
   pm2 stop myid-pwa
   ```

2. Switch to previous version:
   ```bash
   cd /path/to/previous/version
   pm2 start npm --name "myid-pwa" -- start
   ```

3. Verify health:
   ```bash
   curl http://localhost:3000/api/health
   ```

---

## Support

- Documentation: `/perform1/srv/work/myid-app/README.md`
- Implementation Summary: `/perform1/srv/work/myid-app/IMPLEMENTATION_SUMMARY.md`
- Presentations: `/perform1/srv/work/myid-app/docs/presentations/`

For issues, check logs and health endpoints first.
