import { spawn } from "node:child_process";

export async function execCmd(cmd, args = [], opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("exit", (code) => resolve({ code: code ?? 1, out, err }));
  });
}
