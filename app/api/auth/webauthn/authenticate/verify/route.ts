import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';

const RP_ID = typeof window !== 'undefined' ? window.location.hostname : 'pwa.myid.africa';
const EXPECTED_ORIGIN = `https://${RP_ID}`;

export async function POST(request: Request) {
  try {
    const { credential, challenge } = await request.json();

    // In production: fetch authenticator from database using credential.id
    const authenticator = {
      credentialID: new Uint8Array(),
      credentialPublicKey: new Uint8Array(),
      counter: 0,
    };

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      authenticator,
    });

    if (verification.verified) {
      // Create session, return user data
      return NextResponse.json({
        verified: true,
        user: {
          email: 'user@example.com',
          name: 'Demo User',
        },
      });
    }

    return NextResponse.json({ error: 'Verification failed' }, { status: 401 });
  } catch (error) {
    console.error('WebAuthn verification error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
