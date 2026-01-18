#!/usr/bin/env node
/**
 * QA Gate for HSM Operational Profile
 *
 * This script enforces the following rules to prevent regressions:
 * 1. Role Separation: No non-admin files should reference admin-only PIN types or role prefixes.
 * 2. Banner Display: The main server file must not print "undefined" for slot/label.
 * 3. Admin Gating: Admin routes must be guarded by the 'X-Admin-Op' check.
 */

import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';

const IGNORED_DIRS = ['node_modules/**', '.git/**', '.next/**', '**/*.test.mjs'];

async function main() {
  let failed = false;

  console.log('Running QA Gate for HSM Operational Profile...');

  // Check 1: Role Separation
  const adminDir = path.resolve('backend/routes');
  const files = await glob('**/*.mjs', { ignore: IGNORED_DIRS });

  // Construct check strings dynamically to avoid self-flagging
  const adminPinField = 'so' + '_pin';
  const adminRolePrefix = 'S' + 'O' + '_';

  for (const file of files) {
    const isAdminFile = path.resolve(file).startsWith(adminDir);
    if (isAdminFile) continue;

    const content = await fs.readFile(file, 'utf-8');
    if (content.includes(adminPinField) || content.includes(adminRolePrefix)) {
      console.error(`[FAIL] Role Separation: Found admin-only credential reference in non-admin file: ${file}`);
      failed = true;
    }
  }

  // Check 2: Banner Display
  const serverFile = await fs.readFile('backend/server.mjs', 'utf-8');
  if (serverFile.includes('Slot: undefined') || serverFile.includes('Label: undefined')) {
    console.error('[FAIL] Banner Display: Found "undefined" in server banner output.');
    failed = true;
  }
  if(serverFile.includes('process.env.HSM_SLOT') || serverFile.includes('process.env.HSM_LABEL')){
    console.error('[FAIL] Banner Display: Found process.env.HSM_SLOT or process.env.HSM_LABEL in server banner output.');
    failed = true;
  }


  // Check 3: Admin Gating
  const adminRoutesFile = await fs.readFile('backend/routes/hsm-admin.mjs', 'utf-8');
  if (!adminRoutesFile.includes('requireAdminOp')) {
    console.error('[FAIL] Admin Gating: Admin routes are not guarded by requireAdminOp middleware.');
    failed = true;
  }

  if (failed) {
    console.log('\nHSM Profile QA Gate: FAILED');
    process.exit(1);
  } else {
    console.log('\nHSM Profile QA Gate: PASSED');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
