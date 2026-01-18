/**
 * HSM Tools Module
 *
 * Provides wrappers for p11tool2-remote and csadm-remote commands.
 * Uses CamelCase commands (e.g., ListSlots) as per p11tool2-remote specification.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';

/**
 * Assert that a binary is executable
 * @param {string} binPath - Path to binary
 * @throws {Error} If binary is not executable
 */
function assertExecutable(binPath) {
  try {
    fs.accessSync(binPath, fs.constants.X_OK);
  } catch (err) {
    throw new Error(`[HSM-TOOLS] binary not executable: ${binPath}`);
  }
}

/**
 * Run a command and return stdout/stderr
 * @param {string} bin - Binary path
 * @param {string[]} args - Command arguments
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{out: string, err: string}>}
 */
function runCmd(bin, args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';

    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      reject(new Error(`[HSM-TOOLS] timeout running ${bin} ${args.join(' ')}`));
    }, timeoutMs);

    p.stdout.on('data', (d) => (out += d.toString('utf8')));
    p.stderr.on('data', (d) => (err += d.toString('utf8')));

    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        return resolve({ out, err });
      }
      reject(
        new Error(
          `[HSM-TOOLS] command failed (exit ${code}): ${bin} ${args.join(' ')}\n${(err || out).trim()}`
        )
      );
    });
  });
}

/**
 * List HSM slots using p11tool2-remote ListSlots command
 *
 * Parses output format: "0: 00000000" or "1: 00000009"
 * Returns array of slot IDs as 4-digit strings: ["0000", "0009"]
 *
 * @param {string} p11tool2_cmd - Path to p11tool2-remote binary
 * @returns {Promise<string[]>} Array of slot IDs (4-digit strings)
 */
export async function listSlots(p11tool2_cmd = '/usr/bin/p11tool2-remote') {
  assertExecutable(p11tool2_cmd);

  const { out } = await runCmd(p11tool2_cmd, ['ListSlots'], 15000);

  if (!out || !out.trim()) {
    throw new Error('[HSM-TOOLS] ListSlots returned empty output');
  }

  // Parse output format: "0: 00000000\n1: 00000009\n"
  // Expected format: slot_index: slot_id (8-digit hex)
  const lines = out.trim().split('\n');
  const slots = [];

  for (const line of lines) {
    const match = line.match(/^\s*\d+:\s+(\d+)/);
    if (match) {
      // Extract slot ID and format as 4-digit string
      const slotId = match[1];
      // Take last 4 digits (e.g., "00000000" -> "0000", "00000009" -> "0009")
      const slot4 = slotId.slice(-4);
      slots.push(slot4);
    }
  }

  if (slots.length === 0) {
    throw new Error(`[HSM-TOOLS] ListSlots no valid slots found in output:\n${out}`);
  }

  return slots;
}

/**
 * List HSM users using csadm-remote listuser command
 *
 * @param {string} csadm_cmd - Path to csadm-remote binary
 * @returns {Promise<string>} Raw output from listuser command
 */
export async function listUsers(csadm_cmd = '/usr/bin/csadm-remote') {
  assertExecutable(csadm_cmd);

  const { out } = await runCmd(csadm_cmd, ['listuser'], 15000);

  return out;
}

/**
 * Build Security Officer username by convention
 * @param {string} slot - Slot identifier (e.g., "0000", "0009")
 * @returns {string} Username (e.g., "SO_0000")
 */
export function soUser(slot) {
  const slot4 = String(slot).padStart(4, '0');
  return `SO_${slot4}`;
}

/**
 * Build User username by convention
 * @param {string} slot - Slot identifier (e.g., "0000", "0009")
 * @returns {string} Username (e.g., "USR_0000")
 */
export function usrUser(slot) {
  const slot4 = String(slot).padStart(4, '0');
  return `USR_${slot4}`;
}

/**
 * Build Key Manager username by convention
 * @param {string} slot - Slot identifier (e.g., "0000", "0009")
 * @returns {string} Username (e.g., "KM_0000")
 */
export function kmUser(slot) {
  const slot4 = String(slot).padStart(4, '0');
  return `KM_${slot4}`;
}
