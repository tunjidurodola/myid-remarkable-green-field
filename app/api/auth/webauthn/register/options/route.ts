import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';

const RP_NAME = 'myID.africa';
const RP_ID = typeof window !== 'undefined' ? window.location.hostname : 'pwa.myid.africa';

export async function POST(request: Request) {
  try {
    const { userId, userName, userDisplayName } = await request.json();

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userId,
      userName,
      userDisplayName,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        residentKey: 'required',
        userVerification: 'required',
      },
    });

    // Store challenge in session/database for verification
    // For now, we'll return it to be stored client-side
    return NextResponse.json({ options, challenge: options.challenge });
  } catch (error) {
    console.error('WebAuthn registration options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}
