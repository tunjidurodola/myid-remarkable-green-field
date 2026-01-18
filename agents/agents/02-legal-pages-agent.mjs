import fs from "node:fs";
import { httpHead } from "../lib/http.mjs";
import { fail, ok, writeEvidence } from "../lib/report.mjs";

const policy = JSON.parse(fs.readFileSync("/perform1/srv/work/myid-app/agents/policy/compliance.json", "utf-8"));
const base = policy.services.pwa_server.base_url;

const termsUrl = base + policy.legal.terms_path;
const privacyUrl = base + policy.legal.privacy_path;

const t = await httpHead(termsUrl);
const p = await httpHead(privacyUrl);

writeEvidence("legal-head.json", { termsUrl, privacyUrl, terms: t, privacy: p });

if (!t.ok) fail(`Terms endpoint not OK: ${termsUrl} (HTTP ${t.status})`);
if (!p.ok) fail(`Privacy endpoint not OK: ${privacyUrl} (HTTP ${p.status})`);

ok(`Legal endpoints OK: ${policy.legal.terms_path}, ${policy.legal.privacy_path}`);
