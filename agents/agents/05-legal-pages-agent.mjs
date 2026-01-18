import { loadPolicyFromEnv, evidence } from "./_shared.mjs";
import { httpHeadOk, httpGetText } from "../lib/http.mjs";

const { policy, runId } = loadPolicyFromEnv();

const base = policy.services.pwaServer.baseUrl;
const termsUrl = `${base}${policy.legal.termsPath}`;
const privacyUrl = `${base}${policy.legal.privacyPath}`;

await httpHeadOk(termsUrl);
await httpHeadOk(privacyUrl);

const terms = await httpGetText(termsUrl);
const privacy = await httpGetText(privacyUrl);

if (!terms.toLowerCase().includes("terms") && terms.length < 200) {
  throw new Error("Terms page content looks empty/incorrect");
}
if (!privacy.toLowerCase().includes("privacy") && privacy.length < 200) {
  throw new Error("Privacy page content looks empty/incorrect");
}

await evidence(runId, "legal-pages.json", {
  ok: true,
  termsUrl,
  privacyUrl,
  termsBytes: terms.length,
  privacyBytes: privacy.length
});

console.log("Legal pages reachable and non-empty.");
process.exit(0);
