/**
 * Audit Logging Module
 *
 * Provides a structured audit logging facility for HSM operations.
 * Logs are written as JSON lines to stdout.
 */

import crypto from 'crypto';

// Get a request ID from the environment, or generate one
function getRequestId() {
  return process.env.REQUEST_ID || `gen_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Write a structured audit log entry for an HSM operation.
 *
 * @param {object} event - The audit event details.
 * @param {string} event.op - The operation performed (e.g., 'sign', 'listUsers').
 * @param {string} event.slot - The HSM slot involved.
 * @param {'USR'|'SO'} event.principal - The principal performing the operation.
 * @param {'OK'|'FAIL'} event.result - The result of the operation.
 * @param {string} [event.endpoint] - The API endpoint that triggered the operation.
 * @param {string} [event.error_code] - An error code if the operation failed.
 * @param {object} [event.payload] - An optional payload to be hashed.
 */
export function audit(event) {
  const logEntry = {
    ts: new Date().toISOString(),
    request_id: getRequestId(),
    endpoint: event.endpoint || 'internal',
    op: event.op,
    slot: event.slot,
    principal: event.principal,
    result: event.result,
    error_code: event.error_code || null,
    payload_sha256: event.payload ? crypto.createHash('sha256').update(JSON.stringify(event.payload)).digest('hex') : null,
  };

  // Write to stdout as a JSON line
  process.stdout.write(JSON.stringify(logEntry) + '\n');
}
