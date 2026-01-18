import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
  let commit = 'unknown';
  try {
    // Get the short commit hash
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (error) {
    // This will fail if not in a git repository or if git is not installed.
    // In such cases, we'll just use 'unknown'.
    console.error('Failed to get git commit hash:', error);
  }

  // Note: This is the request time, not the actual build time.
  // For a more accurate build time, you would need to inject it at build time.
  const buildTime = new Date().toISOString();

  return NextResponse.json({
    ok: true,
    service: 'pwa',
    commit,
    buildTime,
  });
}
