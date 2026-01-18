# myID.africa HSM Backend Service

HSM-backed cryptographic signing service using PKCS#11 interface to Utimaco HSM on node c3 (172.27.127.129).

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your HSM credentials
```

3. Run the service:
```bash
# Development
npm run dev

# Production
npm start
```

## HSM Configuration

The service connects to the Utimaco HSM on:
- **Host**: 172.27.127.129 (node c3)
- **Slot**: 0 (Root CA slot)
- **Label**: pocketOne_CA
- **Module**: `/opt/utimaco/lib/libcs_pkcs11_R3.so`

### HSM Slot Segmentation (Vault-Driven)

The service enforces **fail-closed** slot segmentation using Vault KV-v2:

#### Vault Configuration Paths

**HSM Configuration** (`c3-hsm/myid-hsm/config`):
```json
{
  "hsm_host": "172.27.127.129",
  "enabled_slots": ["0000", "0009"],
  "default_slot": "0000",
  "p11tool2_cmd": "/usr/bin/p11tool2-remote",
  "csadm_cmd": "/usr/bin/csadm-remote"
}
```

**Slot PINs** (`c3-hsm/slot_XXXX`):
```json
{
  "so_pin": "security-officer-pin",
  "usr_pin": "user-pin",
  "km_pin": "key-manager-pin (optional)"
}
```

Example paths:
- `c3-hsm/slot_0000` - Slot 0 PINs
- `c3-hsm/slot_0009` - Slot 9 PINs

#### Username Derivation Convention

Usernames are derived by convention (NOT stored in Vault):
- Security Officer: `SO_0000`, `SO_0009`
- User: `USR_0000`, `USR_0009`
- Key Manager: `KM_0000`, `KM_0009`

#### Startup Validation

The service performs fail-closed validation at startup:
1. ✓ Load config from Vault `c3-hsm/myid-hsm/config`
2. ✓ Validate `default_slot` is in `enabled_slots`
3. ✓ Verify tool executables exist (`p11tool2-remote`, `csadm-remote`)
4. ✓ Run `ListSlots` and verify all enabled slots are present
5. ✓ Load slot PINs for all enabled slots (requires `so_pin` and `usr_pin`)
6. ✓ Cache validated state in memory

**If any validation fails, the process exits immediately (fail-closed).**

## API Endpoints

### Health Check
```bash
GET /health
GET /health/detailed  # Requires X-API-Key
```

### HSM Readiness Check
```bash
GET /api/hsm/readiness
X-API-Key: your-api-key
```

**Response:**
```json
{
  "status": "ok",
  "host": "172.27.127.129",
  "enabled_slots": ["0000", "0009"],
  "default_slot": "0000",
  "tools": {
    "p11tool2_cmd": "/usr/bin/p11tool2-remote",
    "csadm_cmd": "/usr/bin/csadm-remote",
    "executable": true
  },
  "slots_seen": ["0000", "0009"],
  "validation_timestamp": "2026-01-18T15:30:00.000Z"
}
```

### Generate Key Pair
```bash
POST /api/crypto/keygen
X-API-Key: your-api-key

{
  "algorithm": "RSA",
  "keySize": 2048,
  "label": "user-key-label"
}
```

### Sign Data
```bash
POST /api/crypto/sign
X-API-Key: your-api-key

{
  "data": "data-to-sign",
  "keyHandle": "hsm://0/key-label",
  "algorithm": "SHA256"
}
```

### Issue Certificate
```bash
POST /api/crypto/cert/issue
X-API-Key: your-api-key

{
  "publicKey": "-----BEGIN PUBLIC KEY-----...",
  "subject": {
    "commonName": "User Name",
    "country": "ZA",
    "organization": "pocketOne"
  },
  "validityDays": 365,
  "keyUsage": ["digitalSignature", "keyEncipherment"]
}
```

### QES Digital Signature
```bash
POST /api/crypto/qes/sign
X-API-Key: your-api-key

{
  "documentHash": "sha256-hash",
  "certificateId": "cert-id",
  "userId": "user-id"
}
```

## Security Notes

- Private keys NEVER leave the HSM
- All signing operations are performed within the HSM
- API key authentication required for all endpoints
- **All secrets stored in Vault KV-v2** (API keys, PINs, JWT secrets)
- **Only allowed environment variables for secrets**: `VAULT_ADDR`, `VAULT_TOKEN` (or `VAULT_TOKEN_FILE`)
- **No PINs or API keys in environment variables or code**
- Fail-closed architecture: missing config or PINs cause immediate process exit
- Username derivation by convention (not stored in Vault)

## Production Deployment

For production deployment:

1. Install Utimaco PKCS#11 library on the server
2. Configure HSM network access
3. Set strong API keys
4. Enable HTTPS/TLS
5. Implement rate limiting
6. Set up monitoring and logging
7. Configure firewall rules
