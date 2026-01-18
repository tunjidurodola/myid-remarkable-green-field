#!/usr/bin/env bash
set -euo pipefail
die(){ echo "[FAIL] $*" >&2; exit 1; }
ok(){ echo "[OK] $*"; }
info(){ echo "[*] $*"; }
