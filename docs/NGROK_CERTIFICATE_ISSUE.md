# ngrok Certificate Issue Explained

**Issue**: `pwa.myid.africa` showing ngrok's certificate (`*.in.ngrok.io`) instead of your myid.africa certificate

---

## Why This Is Happening

### Current Situation

When you access `https://pwa.myid.africa`:

1. **DNS Resolution** ✅
   - `pwa.myid.africa` → ngrok edge servers (13.204.160.220, etc.)
   - DNS is configured correctly

2. **ngrok Receives Request** ✅
   - ngrok edge server receives HTTPS request
   - Checks if domain is reserved in your account

3. **Certificate Mismatch** ❌
   - Domain `pwa.myid.africa` is NOT reserved in your account
   - ngrok serves with default wildcard certificate: `*.in.ngrok.io`
   - Your uploaded certificates are NOT used

4. **Tunnel Not Established** ❌
   - ngrok shows error page: "endpoint is offline (ERR_NGROK_3200)"
   - Tunnel daemon (on this server) can't start because domain isn't reserved

---

## ngrok Custom Certificates - How It Works

### With Reserved Domain ✅

```
User → pwa.myid.africa (HTTPS)
      ↓
      DNS → ngrok edge (13.204.160.220)
      ↓
      ngrok checks: Is pwa.myid.africa reserved for account 'Tunji Durodola'?
      ↓ YES
      ✅ Uses custom TLS certificate (myid.africa cert)
      ✅ Establishes tunnel to server
      ✅ Forwards to localhost:3000
      ✅ PWA loads
```

### Without Reserved Domain ❌ (Current State)

```
User → pwa.myid.africa (HTTPS)
      ↓
      DNS → ngrok edge (13.204.160.220)
      ↓
      ngrok checks: Is pwa.myid.africa reserved for account 'Tunji Durodola'?
      ↓ NO
      ❌ Uses default ngrok certificate (*.in.ngrok.io)
      ❌ No tunnel exists
      ❌ Shows error page: "endpoint is offline"
```

---

## The Solution

### Reserve the Domain in ngrok Dashboard

**This is the ONLY step needed** to fix the certificate issue:

1. **Go to ngrok dashboard**:
   - URL: https://dashboard.ngrok.com/domains

2. **Add Domain**:
   - Click "New Domain" or "Add Domain"
   - Enter: `pwa.myid.africa`
   - Click "Continue"

3. **Certificate Upload** (may be automatic):
   - ngrok may auto-detect your uploaded certificates
   - Or prompt you to upload:
     - Certificate: `/etc/plumes/myid/africa/fullchain.pem`
     - Private Key: `/etc/plumes/myid/africa/privatekey.pem`

4. **Save/Confirm**

**That's it!** Once reserved:
- ngrok will use your myid.africa certificate
- Tunnel will connect
- `https://pwa.myid.africa` will work

---

## After Reserving the Domain

### Start the tunnel:

```bash
cd /perform1/srv/work/myid-app
npx pm2 start ecosystem.config.cjs --only myid-ngrok
```

### Verify tunnel:

```bash
# Check logs (should show success)
npx pm2 logs myid-ngrok --lines 10

# Should see:
# "started tunnel" obj=tunnels url=https://pwa.myid.africa
```

### Test certificate:

```bash
# Check certificate
curl -v https://pwa.myid.africa 2>&1 | grep "subject:"

# Should show:
# subject: CN=myid.africa (or similar - your cert)
# NOT: subject: CN=*.in.ngrok.io
```

### Test on iPhone:

```
Safari → https://pwa.myid.africa

Should see:
✅ Valid certificate (no warnings)
✅ PWA loads
✅ No ngrok interstitial page
✅ Professional myid.africa branding
```

---

## Why Your Certificate Upload Didn't Work Yet

When you uploaded TLS certificates to ngrok earlier, they were likely:

1. **Uploaded to your account** ✅
2. **Associated with myid.africa domain** ✅
3. **But the domain itself isn't reserved** ❌

**ngrok only uses custom certificates for reserved domains.**

Think of it like this:
- **Uploading certificates** = "Here are my certificates for myid.africa"
- **Reserving domain** = "I own pwa.myid.africa and want to use it"

Both steps are needed. The reservation links the domain to your account and triggers use of your certificates.

---

## Current Certificate Details

### What Safari Shows Now:

```
Certificate: *.in.ngrok.io
Issuer: Let's Encrypt (E8)
Validity: Dec 5, 2025 - Mar 5, 2026
Purpose: ngrok's wildcard certificate for India region
```

### What You Should See (After Reserving):

```
Certificate: myid.africa (or *.myid.africa)
Issuer: Your CA (likely Sectigo/Comodo based on your cert)
Validity: Your certificate dates
Purpose: Your custom certificate for professional branding
```

---

## Alternative: Use Local HTTPS Now

**Don't want to configure ngrok right now?**

Your local HTTPS is already working with the correct certificate:

```bash
# Check local certificate
curl -vk https://192.168.0.16 2>&1 | grep "subject:"

# Should show your myid.africa certificate
```

**Test on iPhone**:
1. Connect to same Wi-Fi
2. Safari → `https://192.168.0.16`
3. See your myid.africa certificate
4. All PWA features work

---

## Summary

**Current State**:
- DNS: ✅ Configured correctly
- ngrok account: ✅ Has TLS certificates uploaded
- Domain reservation: ❌ `pwa.myid.africa` not reserved
- Result: ❌ ngrok using default certificate, tunnel offline

**To Fix**:
1. Reserve `pwa.myid.africa` at https://dashboard.ngrok.com/domains
2. Start tunnel: `npx pm2 start ecosystem.config.cjs --only myid-ngrok`
3. Test: Certificate will be correct, PWA will load

**Time Required**: 2 minutes

**Immediate Alternative**:
- Use `https://192.168.0.16` (local network)
- Already has correct certificate
- All PWA features work
