#!/usr/bin/env bash

set -euo pipefail

export VAULT_KV_MOUNT="${VAULT_KV_MOUNT:-kv-v2}"

cd /perform1/srv/work/myid-app
node /perform1/srv/work/myid-app/fixpack/orchestrator.mjs
