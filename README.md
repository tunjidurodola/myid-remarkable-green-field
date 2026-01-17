# myID.africa - Digital Identity PWA

A fully functional Progressive Web App for secure digital identity management with enterprise consent workflows.

## Features

- ✅ **47 Routes**: Complete navigation from splash to UCT audit
- ✅ **PWA Ready**: Installable, offline-capable, with service worker
- ✅ **BLAKE3 Cryptography**: Selective disclosure and claim commitments
- ✅ **Encrypted Storage**: IndexedDB with localStorage fallback
- ✅ **Master/Trust Codes**: pocketOne OID namespace compliance
- ✅ **UCT Flow**: Enterprise consent lifecycle management
- ✅ **HSM Backend**: Node 22 + PKCS#11 signing service
- ✅ **Credential Formats**: mDL, eIDAS2, ICAO DTC, W3C DIDs
- ✅ **WebAuthn/FIDO**: Passkeys and hardware security keys
- ✅ **OTP Manager**: TOTP generation and storage
- ✅ **Recovery Codes**: Backup authentication system
- ✅ **PKI Lifecycle**: Certificate issuance and QES signing

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Crypto**: @noble/hashes (BLAKE3)
- **Storage**: idb (IndexedDB)
- **Auth**: @simplewebauthn/browser
- **OTP**: otpauth
- **Testing**: Playwright

## Project Structure

```
myid-app/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication routes
│   ├── onboarding/        # 9-step onboarding flow
│   ├── security/          # Security features (QES, PKI, passkeys)
│   ├── enterprise/        # UCT consent flows
│   ├── otp/               # OTP management
│   └── ...                # Other routes
├── components/
│   ├── atoms/             # Basic UI components
│   ├── molecules/         # Composite components
│   └── organisms/         # Complex components
├── lib/
│   ├── crypto/            # BLAKE3 implementation
│   ├── storage/           # Encrypted storage layer
│   ├── consent/           # UCT manager
│   ├── otp/               # TOTP manager
│   ├── auth/              # WebAuthn & recovery codes
│   └── credentials/       # Credential formats (mDL, eIDAS2, DTC, W3C)
├── backend/               # HSM signing service
├── docs/
│   └── presentations/     # Credential format presentations
├── scripts/               # Build and utility scripts
└── tests/
    └── e2e/               # Playwright E2E tests
```

## Getting Started

### Prerequisites

- Node.js 22.22.0 or higher
- npm or yarn

### Installation

```bash
# Navigate to project directory
cd myid-app

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev

# Open browser to http://localhost:3000
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run E2E tests
npm test

# Run with UI
npm run test:ui

# Audit routes
npm run audit:routes
```

## HSM Backend Service

The HSM backend service provides cryptographic signing operations via PKCS#11 interface to Utimaco HSM.

### Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with HSM credentials

# Start service
npm start
```

### Configuration

Point backend to c3 HSM:
- **Host**: 172.27.127.129
- **Port**: 3001
- **Slot**: 0 (Root CA)
- **Module**: `/opt/utimaco/lib/libcs_pkcs11_R3.so`

See `backend/README.md` for detailed configuration.

## Routes

All 47 routes from `route-manifest.json` are implemented:

### Authentication
- `/` - Splash screen
- `/auth/signin` - Sign in
- `/auth/signup` - Sign up

### Onboarding (9 steps)
- `/onboarding/step-1` through `/onboarding/step-9`

### Core
- `/profile` - User profile
- `/dashboard` - Main dashboard
- `/verification-success` - Onboarding completion

### Security
- `/security/qes` - QES digital signatures
- `/security/pki` - PKI key issuance
- `/security/passkeys` - Passkey management
- `/security/wallet` - Digital wallet
- `/security/digital-ids` - Digital IDs
- `/security/fido-setup` - FIDO setup
- `/security/hardware-tokens` - Hardware key management
- `/security/recovery` - Account recovery
- `/security/backup-codes` - Backup codes

### Enterprise Consent
- `/enterprise/uct-scanner` - RPID QR scanner
- `/enterprise/uct-consent` - Data selection
- `/enterprise/uct-generated` - UCT generation
- `/enterprise/uct-authorization` - Authorization
- `/enterprise/uct-audit` - Audit trail
- `/enterprise/tokenization` - Identity tokenization

### OTP
- `/otp` - OTP dashboard
- `/otp/add` - Add authenticator
- `/otp/manage` - Manage OTPs

### Other
- `/settings/` - Settings
- `/trust-email/` - Email management
- `/subscription` - Pricing plans
- `/legal` - Legal & compliance
- `/scanner` - QR/barcode scanner
- `/sharing` - Credential sharing

## Credential Formats

### ISO 18013-5 mDL
Mobile driving license with CBOR encoding and selective disclosure.

```typescript
import { MDLCredential } from '@/lib/credentials/mdl-iso18013-5';
const mdl = MDLCredential.create(userData, mc, tc);
```

### eIDAS2
European Digital Identity Wallet credentials.

```typescript
import { eIDAS2Wallet } from '@/lib/credentials/eidas2';
const pid = eIDAS2Wallet.createPID(userData, issuer, mc, tc);
```

### ICAO DTC
Digital Travel Credentials per ICAO 9303.

```typescript
import { ICAODTCCredential } from '@/lib/credentials/icao-dtc';
const dtc = ICAODTCCredential.create(documentData, mc, tc);
```

### W3C DIDs/VCs
Decentralized identifiers and verifiable credentials.

```typescript
import { W3CDID } from '@/lib/credentials/w3c-did';
const did = W3CDID.generate(publicKey);
const vc = W3CDID.createCredential(issuerDID, holderDID, claims);
```

## Security

### Data Storage
- All PII encrypted locally
- BLAKE3 for hashing
- Master Code (MC) and Trust Code (TC) embedded in credentials
- No PII sent to backend except hashed/derived forms

### Authentication
- WebAuthn/Passkeys (platform authenticator)
- FIDO hardware keys (cross-platform)
- Recovery codes (backup)
- OTP (TOTP)

### Cryptography
- BLAKE3 for selective disclosure
- HSM for signing (RSA/ECDSA)
- PKI certificate lifecycle
- QES-compliant signatures

## Presentations

Detailed technical presentations for each credential format:
- [ISO 18013-5 mDL](./docs/presentations/18013-5-mdoc.md)
- [eIDAS2](./docs/presentations/eidas2.md)
- [ICAO DTC](./docs/presentations/icao-dtc.md)
- [W3C DIDs/VCs](./docs/presentations/w3c-did.md)

## Testing

### E2E Tests
```bash
npm test
```

Tests cover:
- All route navigation
- Authentication flow
- Complete onboarding (9 steps)
- UCT generation flow
- OTP management
- Security features
- PWA functionality

### Route Audit
```bash
npm run audit:routes
```

Validates all manifest routes are implemented.

## Deployment

### Frontend (Next.js)
```bash
npm run build
npm start
```

### Backend (HSM Service)
```bash
cd backend
npm start
```

Ensure HSM network connectivity to 172.27.127.129:3001.

## Environment Variables

Create `.env.local`:

```env
# HSM Backend
NEXT_PUBLIC_HSM_URL=http://172.27.127.129:3001
NEXT_PUBLIC_API_KEY=your-api-key

# Feature Flags
NEXT_PUBLIC_ENABLE_BIOMETRICS=true
NEXT_PUBLIC_ENABLE_NFC=true
```

## Contributing

This is a production-ready implementation. All features are functional and tested.

## License

Proprietary - pocketOne

## Contact

- **Project**: myID.africa
- **Platform**: pocketOne
- **Host**: nv2
- **HSM**: c3 (172.27.127.129)
