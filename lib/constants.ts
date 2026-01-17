// pocketOne OID namespace constants
export const OID_NAMESPACE = {
  MASTER_CODE: '1.3.6.1.4.1.54392.5.1824',
  TRUST_CODE: '1.3.6.1.4.1.54392.5.1825',
  CLAIM_ROOT: '1.3.6.1.4.1.54392.5',
} as const;

// Credential format identifiers
export const CREDENTIAL_FORMATS = {
  MDOC: 'org.iso.18013.5.1.mDL',
  EIDAS2: 'eu.europa.ec.eudi.pid.1',
  ICAO_DTC: 'icao.9303.dtc',
  W3C_VC: 'https://www.w3.org/2018/credentials/v1',
} as const;

// HSM Configuration
export const HSM_CONFIG = {
  HOST: process.env.HSM_HOST || '172.27.127.129',
  PORT: process.env.HSM_PORT || '6321',
  SLOT: process.env.HSM_SLOT || '0',
  LABEL: process.env.HSM_LABEL || 'pocketOne_CA',
} as const;

// Storage keys
export const STORAGE_KEYS = {
  SESSION: 'myid_session',
  USER_DATA: 'myid_user_data',
  CREDENTIALS: 'myid_credentials',
  CONSENT_HISTORY: 'myid_consent_history',
  OTP_SECRETS: 'myid_otp_secrets',
  PASSKEYS: 'myid_passkeys',
  RECOVERY_CODES: 'myid_recovery_codes',
  PKI_KEYS: 'myid_pki_keys',
} as const;

// Route navigation map
export const ROUTE_MAP = {
  SPLASH: '/',
  SIGNIN: '/auth/signin',
  SIGNUP: '/auth/signup',
  PROFILE: '/profile',
  DASHBOARD: '/dashboard',
  ONBOARDING_START: '/onboarding/step-1',
} as const;
