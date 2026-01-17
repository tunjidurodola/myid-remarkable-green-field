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

## API Endpoints

### Health Check
```bash
GET /health
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
- HSM PIN must be stored securely (never in code)
- Use environment variables for all sensitive configuration

## Production Deployment

For production deployment:

1. Install Utimaco PKCS#11 library on the server
2. Configure HSM network access
3. Set strong API keys
4. Enable HTTPS/TLS
5. Implement rate limiting
6. Set up monitoring and logging
7. Configure firewall rules
