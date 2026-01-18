import { HsmRemote } from "./hsm-remote.mjs";

export async function runHsmSelfTest() {
  const h = new HsmRemote();
  const gate = await h.startupGate();
  return {
    ok: true,
    slots: gate.listSlotsRaw
  };
}