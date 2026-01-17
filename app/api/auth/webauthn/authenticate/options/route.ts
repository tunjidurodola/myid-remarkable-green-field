import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

const RP_ID = typeof window !== 'undefined' ? window.location.hostname : 'pwa.myid.africa';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    // In production, fetch user's registered credentials from database
    const allowCredentials: any[] = []; // Empty = discoverable credentials

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'required',
    });

    return NextResponse.json({ options, challenge: options.challenge });
  } catch (error) {
    console.error('WebAuthn authentication options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}
