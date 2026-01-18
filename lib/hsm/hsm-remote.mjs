import fs from "node:fs";
import fsP from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { vaultReadKv2 } from "./vault-kv2.mjs";

const BIN_P11 = "/usr/bin/p11tool2-remote";
const BIN_CSADM = "/usr/bin/csadm-remote";

function must(name, v) {
  if (!v) throw new Error(`[HSM] missing ${name}`);
  return v;
}

function assertExecutable(p) {
  fs.accessSync(p, fs.constants.X_OK);
}

function runCmd(bin, args, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";

    const t = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`[HSM] timeout running ${bin} ${args.join(" ")}`));
    }, timeoutMs);

    p.stdout.on("data", d => out += d.toString("utf8"));
    p.stderr.on("data", d => err += d.toString("utf8"));

    p.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) return resolve({ out, err });
      reject(new Error(`[HSM] cmd failed (${code}): ${bin} ${args.join(" ")}\n${(err || out).trim()}`));
    });
  });
}

async function withTempFile(content, mode, suffix, fn) {
  const dir = await fsP.mkdtemp(path.join(os.tmpdir(), "myid-hsm-"));
  const file = path.join(dir, suffix);
  await fsP.writeFile(file, content, { mode });
  try { return await fn(file); }
  finally { await fsP.rm(dir, { recursive: true, force: true }); }
}

/**
 * HSM config is read from Vault mount "c3-hsm" by default.
 * Override with HSM_VAULT_MOUNT if you ever change it.
 */
export class HsmRemote {
  constructor({ vaultMount } = {}) {
    this.vaultMount = vaultMount || process.env.HSM_VAULT_MOUNT || "c3-hsm";
  }

  async endpoint() {
    const ep = await vaultReadKv2(this.vaultMount, "endpoint");
    return {
      host: must("endpoint.host", ep.host),
      timeoutMs: Number(ep.timeout_ms || 15000)
    };
  }

  async startupGate() {
    assertExecutable(BIN_P11);
    assertExecutable(BIN_CSADM);
    // Case-sensitive: "ListSlots"
    const { out } = await runCmd(BIN_P11, ["ListSlots"], { timeoutMs: 15000 });
    if (!out || !out.trim()) throw new Error("[HSM] ListSlots returned empty output");
    // Accept your observed output: "0: 00000000"
    if (!/^\s*\d+:\s+\d+/m.test(out)) throw new Error(`[HSM] ListSlots unexpected output:\n${out}`);
    return { ok: true, listSlotsRaw: out };
  }

  async listSlots() {
    const { timeoutMs } = await this.endpoint();
    const { out } = await runCmd(BIN_P11, ["ListSlots"], { timeoutMs });
    return out;
  }

  /**
   * Admin login uses key-file auth:
   * Vault path: c3-hsm/admin
   * Expected keys: admin_username, admin_key_pem
   */
  async adminLogin() {
    const { timeoutMs } = await this.endpoint();
    const adm = await vaultReadKv2(this.vaultMount, "admin");
    const username = must("admin.admin_username", adm.admin_username);
    const keyPem = must("admin.admin_key_pem", adm.admin_key_pem);

    // p11tool2-remote supports: Login=ADMIN,/path/to/ADMIN.key
    return await withTempFile(keyPem, 0o600, "ADMIN.key", async (keyPath) => {
      const { out } = await runCmd(BIN_P11, [`Login=${username},${keyPath}`], { timeoutMs });
      return out;
    });
  }

  /**
   * Slot login for SO/USR:
   * Vault path: c3-hsm/slots/0007/usr etc.
   * Expected keys: username, pin
   *
   * NOTE: CryptoServer tool supports LoginSO= and LoginUser=
   * We will use those directly.
   */
  async slotLogin(slot4, role /* "so"|"usr" */) {
    const { timeoutMs } = await this.endpoint();

    if (!/^\d{4}$/.test(String(slot4))) throw new Error("slot must be 4 digits e.g. 0007");
    if (!["so", "usr"].includes(role)) throw new Error("role must be so|usr");

    const doc = await vaultReadKv2(this.vaultMount, `slots/${slot4}/${role}`);
    const username = must(`slots/${slot4}/${role}.username`, doc.username);
    const pin = must(`slots/${slot4}/${role}.pin`, doc.pin);

    const cmd = role === "so" ? "LoginSO" : "LoginUser";
    const { out } = await runCmd(BIN_P11, [`${cmd}=${username},${pin}`], { timeoutMs });
    return out;
  }

  /**
   * Basic admin user listing (csadm-remote listuser)
   * Useful for auditing segmentation.
   */
  async listUsers() {
    const { timeoutMs } = await this.endpoint();
    const { out } = await runCmd(BIN_CSADM, ["listuser"], { timeoutMs });
    return out;
  }
}
