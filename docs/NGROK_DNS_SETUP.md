# ngrok Custom Domain DNS Setup Required

**Date**: January 17, 2026
**Status**: ⚠️ DNS Configuration Needed

---

## Current Situation

### What's Working ✅
- ngrok tunnel is configured and running
- ngrok account has `myid.africa` domain reserved
- TLS certificates uploaded to ngrok
- Tunnel active: `https://myid.africa` → `http://localhost:3000`

### What's Not Working ❌
- DNS for `myid.africa` currently points to: `83.111.76.58` (different server)
- This server is hosting a different website (myID Africa marketing site)
- Users accessing `https://myid.africa` get the old site, not the PWA

---

## The Issue

When you access `https://myid.africa`:
1. DNS resolves to `83.111.76.58` (not ngrok)
2. Browser connects to that server
3. Gets the marketing website, not the PWA

For ngrok custom domain to work:
1. DNS must point to ngrok's edge servers
2. ngrok receives the request
3. ngrok tunnels it to this server
4. PWA is served

---

## Solution Options

### Option 1: Update DNS for myid.africa (Full Migration)

**Update DNS records for myid.africa:**

1. **Check ngrok Edge Configuration**:
   ```bash
   # ngrok should provide CNAME target or IP addresses
   # Check your ngrok dashboard: https://dashboard.ngrok.com/
   # Look for "Domains" → "myid.africa" → "DNS Configuration"
   ```

2. **Update DNS Records**:
   - Remove A record pointing to `83.111.76.58`
   - Add CNAME record pointing to ngrok edge (usually something like `tunnel.us.ngrok.com`)
   - Or follow specific DNS instructions from ngrok dashboard

3. **Wait for DNS propagation** (5-60 minutes)

4. **Test**:
   ```bash
   curl https://myid.africa
   # Should show the PWA
   ```

**Impact**: The marketing site at 83.111.76.58 will no longer be accessible at myid.africa

---

### Option 2: Use Subdomain (Recommended)

**Use `pwa.myid.africa` or `m.myid.africa` for the PWA:**

1. **Reserve subdomain in ngrok**:
   - Go to ngrok dashboard: https://dashboard.ngrok.com/
   - Navigate to "Domains"
   - Add new domain: `pwa.myid.africa` (or `m.myid.africa`)
   - Upload TLS certificates for the subdomain

2. **Update PM2 config**:
   Already configured to use `pwa.myid.africa`:
   ```javascript
   args: 'http --domain=pwa.myid.africa 3000 --log stdout'
   ```

3. **Create DNS CNAME record**:
   ```
   pwa.myid.africa  CNAME  tunnel.us.ngrok.com  (or ngrok's provided target)
   ```

4. **Restart ngrok**:
   ```bash
   npx pm2 restart myid-ngrok
   ```

5. **Test**:
   ```bash
   curl https://pwa.myid.africa
   ```

**Benefits**:
- Marketing site stays at `https://myid.africa`
- PWA accessible at `https://pwa.myid.africa`
- No conflict between services

---

### Option 3: Use Local HTTPS Only

**Skip ngrok external access, use local network HTTPS:**

- URL: `https://192.168.0.16`
- Already configured with Apache and your SSL certificates
- Works on local network / ZeroTier VPN
- No DNS changes needed

**Stop ngrok**:
```bash
npx pm2 stop myid-ngrok
npx pm2 delete myid-ngrok
npx pm2 save
```

---

## Current ngrok Configuration

**Tunnel Status**:
```bash
$ npx pm2 status
│ myid-ngrok │ online │ Port: - (tunnel active)

$ curl http://localhost:4040/api/tunnels
{
  "public_url": "https://myid.africa",
  "proto": "https",
  "config": {
    "addr": "http://localhost:3000"
  }
}
```

**ngrok thinks it's serving**: `https://myid.africa`
**DNS actually points to**: `83.111.76.58` (different server)

---

## DNS Information

### Current DNS
```bash
$ dig +short myid.africa
83.111.76.58
```

### What's at 83.111.76.58
```bash
$ curl -s https://myid.africa | grep title
<title>Home | myID Africa</title>
```
Marketing/informational website for myID Africa

---

## Recommended Approach

**I recommend Option 2 (Subdomain)**:

1. **Reserve `pwa.myid.africa` in ngrok dashboard**
2. **Add CNAME record**: `pwa.myid.africa` → ngrok edge
3. **Update documentation** to use `https://pwa.myid.africa`
4. **Keep marketing site** at `https://myid.africa`

This gives you:
- ✅ Professional URL: `https://pwa.myid.africa`
- ✅ No conflicts with existing site
- ✅ Full PWA features via HTTPS
- ✅ Accessible from anywhere

---

## Steps to Complete Setup

### For Subdomain Approach (pwa.myid.africa):

1. **ngrok Dashboard**:
   - Visit: https://dashboard.ngrok.com/
   - Click "Domains" in left sidebar
   - Click "New Domain" or "Add Domain"
   - Enter: `pwa.myid.africa`
   - Upload TLS certificates (if required)
   - Note the CNAME target provided

2. **DNS Configuration**:
   - Log into your DNS provider
   - Add CNAME record:
     - Name: `pwa`
     - Type: `CNAME`
     - Value: (provided by ngrok, likely `tunnel.us.ngrok.com` or similar)
     - TTL: `300` (5 minutes)

3. **Restart ngrok**:
   ```bash
   npx pm2 restart myid-ngrok
   ```

4. **Wait for DNS propagation** (5-30 minutes):
   ```bash
   # Check if DNS has propagated
   dig +short pwa.myid.africa
   ```

5. **Test**:
   ```bash
   curl https://pwa.myid.africa
   # Should return the PWA HTML
   ```

6. **Test on iPhone**:
   - Open Safari
   - Go to: `https://pwa.myid.africa`
   - Should load PWA with no interstitial page
   - All PWA features work

---

## Alternative: No DNS Changes

If you don't want to modify DNS:

**Use the local HTTPS setup**:
- URL: `https://192.168.0.16` (local network)
- URL: `https://172.27.170.210` (ZeroTier VPN)
- Already configured with Apache + SSL certificates
- No ngrok needed

```bash
# Stop ngrok
npx pm2 stop myid-ngrok
npx pm2 delete myid-ngrok
npx pm2 save
```

---

## Current Access URLs

| URL | Status | Notes |
|-----|--------|-------|
| `https://myid.africa` | ❌ Wrong site | DNS → 83.111.76.58 (marketing site) |
| `https://pwa.myid.africa` | ❌ Not configured | Need to set up in ngrok + DNS |
| `https://192.168.0.16` | ✅ Working | Apache HTTPS (local network) |
| `https://172.27.170.210` | ✅ Working | Apache HTTPS (ZeroTier) |

---

## Testing Status

**Local HTTPS**: ✅ Working
```bash
$ curl -k https://192.168.0.16 | head -1
<!DOCTYPE html><html lang="en">  # PWA loads
```

**ngrok tunnel**: ✅ Active
```bash
$ curl http://localhost:4040/api/tunnels | grep public_url
"public_url": "https://myid.africa"
```

**DNS**: ⚠️ Points elsewhere
```bash
$ dig +short myid.africa
83.111.76.58  # Not this server, not ngrok
```

---

## Summary

**What works now**:
- ✅ Local HTTPS: `https://192.168.0.16`
- ✅ ngrok tunnel configured
- ✅ All 3 PM2 processes running

**What needs configuration**:
- ⚠️ DNS setup for ngrok custom domain
- ⚠️ Either update myid.africa DNS or use pwa.myid.africa subdomain

**Recommended next steps**:
1. Reserve `pwa.myid.africa` in ngrok dashboard
2. Add CNAME record in DNS
3. Wait for propagation
4. Test `https://pwa.myid.africa` on iPhone

---

**For immediate testing**: Use `https://192.168.0.16` on local network (WiFi).
