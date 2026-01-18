You are working in /perform1/srv/work/myid-app.

Goal:
Make myid-hsm enforce HSM slot segmentation using Vault kv-v2 (mount already exists) and your existing secret schema:
For each slot path c3-hsm/slot_000X, the fields are: so_pin, usr_pin, km_pin.
Example command that must work: vault kv get -field=usr_pin c3-hsm/slot_0000 or equivalient in node-vault module

Constraints:
- Do NOT invent new Vault field names. Use so_pin/usr_pin/km_pin only.
- Do NOT store or require usernames in Vault. Derive usernames by convention:
  - SO_0000, USR_0000, KM_0000 etc.
- Only environment variables allowed for secrets are VAULT_ADDR and VAULT_TOKEN (or VAULT_TOKEN_FILE if already supported). No API keys or PINs via env.
- Use p11tool2-remote commands in CamelCase (ListSlots etc). No GNU flags.
- Fail-closed: if Vault config missing, required PIN missing, tools not executable, or enabled slots not present -> process exits before listening.
- Use node-vault module where possible to avoid escaping to a shell. Use the shell where implementation of the module does not permit certain vault actions.

Implement:
1) Add Vault config record path: c3-hsm/myid-hsm/config with keys:
   - hsm_host
   - enabled_slots (JSON array of strings like ["0000","0009"])
   - default_slot
   - p11tool2_cmd (default /usr/bin/p11tool2-remote)
   - csadm_cmd (default /usr/bin/csadm-remote)

2) Create backend/lib/hsm-vault.mjs:
   - readKv2(mountPath) using HTTP API or existing vault client in repo
   - loadMyidHsmConfig()
   - loadSlotPins(slot): reads c3-hsm/slot_${slot} and returns {so_pin, usr_pin, km_pin}
     - strictly require so_pin and usr_pin at minimum (km_pin optional only if feature uses it)
   - never log pin values

3) Create backend/lib/hsm-tools.mjs:
   - listSlots(): exec `${p11tool2_cmd} ListSlots` and parse output into ["0000","0001"...]
   - listUsers(): exec `${csadm_cmd} listuser` and parse names (optional)
   - helper to build usernames: soUser(slot), usrUser(slot), kmUser(slot)

4) Patch myid-hsm startup (backend/server.mjs or wherever myid-hsm entrypoint is):
   - Before app.listen:
     - load config from Vault
     - validate enabled_slots contains default_slot
     - check tool executables exist
     - run listSlots and verify all enabled slots are present
     - load slot pins for enabled_slots and cache in memory
   - Log: host, enabled_slots, default_slot, tools OK, slots seen (no pins)

5) Add endpoint GET /api/hsm/readiness (protected by existing API-key middleware):
   - returns ok + host + enabled_slots + default_slot + tools status + slots_seen

6) Add tests:
   - unit tests to ensure fail-closed when config missing or so_pin/usr_pin missing.

Deliver:
- Commit: "hsm: enforce vault-driven slot segmentation using so_pin/usr_pin/km_pin (fail-closed)"
- Update docs with Vault paths and readiness endpoint.
