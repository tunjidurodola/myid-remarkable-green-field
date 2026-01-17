# myID.africa Runtime Configuration

This document describes the runtime environment for myID.africa PWA deployment.

## PM2 Process Configuration

The application runs three main processes managed by PM2 (via `ecosystem.config.cjs`):

### 1. myid-pwa (Frontend PWA)
- **Name**: `myid-pwa`
- **Port**: `6230`
- **Script**: `node_modules/next/dist/bin/next`
- **Args**: `start`
- **Working Directory**: `/perform1/srv/work/myid-app`
- **Mode**: cluster
- **Instances**: 1
- **Max Memory**: 1G
- **Logs**:
  - Error: `logs/pwa-error.log`
  - Output: `logs/pwa-out.log`

### 2. myid-hsm (Backend HSM Service)
- **Name**: `myid-hsm`
- **Port**: `6321`
- **Script**: `server.mjs`
- **Working Directory**: `/perform1/srv/work/myid-app/backend`
- **Mode**: cluster
- **Instances**: 1
- **Max Memory**: 512M
- **Logs**:
  - Error: `logs/hsm-error.log`
  - Output: `logs/hsm-out.log`

### 3. myid-ngrok (External HTTPS Tunnel)
- **Name**: `myid-ngrok`
- **Port**: N/A (tunnels port 6230)
- **Script**: `ngrok`
- **Args**: `http --domain=pwa.myid.africa 6230 --log stdout`
- **Working Directory**: `/perform1/srv/work/myid-app`
- **Mode**: fork
- **Instances**: 1
- **Logs**:
  - Error: `logs/ngrok-error.log`
  - Output: `logs/ngrok-out.log`

### Additional Services

#### myid-pwa-server
- **Port**: `9495`
- **Script**: `/perform1/srv/work/www/html/myid/pwa-app/server/index.js`
- **Working Directory**: `/perform1/srv/work/www/html/myid/pwa-app`
- **Mode**: cluster
- **Instances**: 2

## Environment Variables

The following environment variables are used across the application. **Values are omitted for security.**

### Frontend (myid-pwa) Environment Variables

Sourced from `.env.local` and `.env.example`:

- `NODE_ENV` - Runtime environment (development/production)
- `NEXT_PUBLIC_API_URL` - Backend API base URL
- `NEXT_PUBLIC_HSM_URL` - HSM service URL
- `NEXT_PUBLIC_API_KEY` - API authentication key
- `NEXT_PUBLIC_ENABLE_BIOMETRICS` - Enable biometric authentication
- `NEXT_PUBLIC_ENABLE_NFC` - Enable NFC features
- `NEXT_PUBLIC_ENABLE_CAMERA` - Enable camera access
- `NEXT_PUBLIC_PWA_ENABLED` - Enable PWA features
- `BUILD_STANDALONE` - Build as standalone application
- `NEXT_TELEMETRY_DISABLED` - Disable Next.js telemetry
- `PORT` - Server port

### Backend (myid-hsm) Environment Variables

Sourced from `ecosystem.config.cjs` and `backend/.env.example`:

#### Server Configuration
- `NODE_ENV` - Runtime environment
- `PORT` - Server port

#### HSM Configuration
- `HSM_HOST` - HSM hardware IP address
- `HSM_PORT` - HSM service port
- `HSM_SLOT` - HSM slot number
- `HSM_LABEL` - HSM key label
- `HSM_PIN` - HSM PIN (production only)
- `PKCS11_MODULE_PATH` - Path to PKCS#11 library

#### Database Configuration
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password (production only)
- `DB_SSL` - Enable SSL for database connection

#### Redis Configuration
- `REDIS_HOST` - Redis server host
- `REDIS_PORT_1` - Redis primary port
- `REDIS_PORT_2` - Redis secondary port (if clustered)
- `REDIS_PORT_3` - Redis tertiary port (if clustered)

#### Authentication Configuration
- `API_KEY` - API authentication key
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRES_IN` - JWT token expiration

#### WebAuthn Configuration
- `WEBAUTHN_RP_NAME` - Relying Party name
- `WEBAUTHN_RP_ID` - Relying Party identifier
- `WEBAUTHN_ORIGIN` - Expected origin for WebAuthn

## Health Check Endpoints

All services expose health check endpoints:

- **myid-pwa-server**: `http://127.0.0.1:9495/api/health`
- **myid-hsm**: `http://127.0.0.1:6321/api/health` or `http://127.0.0.1:6321/health`
- **myid-pwa**: `http://127.0.0.1:6230/` (root endpoint)

## Verification Commands

Check service status:
```bash
pm2 status
```

Run smoke tests:
```bash
node scripts/smoke.mjs
```

View logs:
```bash
pm2 logs myid-pwa
pm2 logs myid-hsm
pm2 logs myid-ngrok
```

## Infrastructure Dependencies

- **Redis TLS**: Ports 7100-7112 with certificates under `/perform1/redis/certs`
- **PostgreSQL**: External database at `db.pocket.one:5432`
- **HSM Hardware**: Utimaco HSM at `172.27.127.129:3001`, slot 0, label `pocketOne_CA`
- **Node.js**: Version 22.22.0 (required)
