# Final Setup Step - Reserve pwa.myid.africa in ngrok

**Status**: One more step needed to complete HTTPS setup

---

## What's Already Done ✅

1. ✅ DNS configured - `pwa.myid.africa` → ngrok edge servers
2. ✅ PM2 configured - ready to use `pwa.myid.africa`
3. ✅ Local HTTPS working - `https://192.168.0.16`
4. ✅ All PWA features enabled

---

## What You Need to Do (2 minutes)

### Reserve pwa.myid.africa in ngrok Dashboard

**Step 1**: Go to ngrok dashboard
- URL: https://dashboard.ngrok.com/domains

**Step 2**: Click "New Domain" or "Add Domain"

**Step 3**: Enter domain name
- Domain: `pwa.myid.africa`
- Click "Continue" or "Add"

**Step 4**: Upload TLS Certificate (if prompted)
- Certificate: `/etc/plumes/myid/africa/fullchain.pem`
- Private Key: `/etc/plumes/myid/africa/privatekey.pem`

**Step 5**: Save/Confirm

That's it! The domain will be reserved for your account.

---

## After Reserving the Domain

### Start ngrok tunnel:

```bash
cd /perform1/srv/work/myid-app
npx pm2 start ecosystem.config.cjs --only myid-ngrok
npx pm2 save
```

### Verify it's working:

```bash
# Check tunnel status
npx pm2 logs myid-ngrok --lines 10 | grep "started tunnel"
# Should show: url=https://pwa.myid.africa

# Test from anywhere
curl https://pwa.myid.africa
# Should return PWA HTML
```

---

## Test on iPhone

Once ngrok is running:

1. **Open Safari on iPhone** (any network - WiFi, cellular, anywhere)

2. **Navigate to**: `https://pwa.myid.africa`

3. **PWA loads** - no interstitial page, professional URL

4. **Test PWA features**:
   - Service Worker registers
   - Add to Home Screen
   - Offline mode works
   - Standalone app mode

---

## Alternative: Test NOW with Local HTTPS

**Don't want to wait? Test immediately:**

1. Connect iPhone to same Wi-Fi
2. Safari → `https://192.168.0.16`
3. All PWA features work

---

## Current Status

```
✅ PWA App: Running (port 3000)
✅ HSM Backend: Running (port 3001)
✅ Apache HTTPS: Active (port 443)
✅ Local HTTPS: https://192.168.0.16 (working)
⏳ ngrok: Waiting for domain reservation

DNS Status:
✅ pwa.myid.africa → ngrok edge servers (configured)

ngrok Status:
⏳ Domain needs to be reserved in dashboard
```

---

## Error Details (For Reference)

When trying to start ngrok without reserving the domain:

```
ERROR: failed to start tunnel: You must reserve a custom hostname for your
account before it can be used to create endpoints.

Reserve this name on your dashboard: https://dashboard.ngrok.com/domains/new

ERR_NGROK_319
```

**Solution**: Reserve `pwa.myid.africa` in dashboard (see steps above)

---

## Summary

**What works now**:
- ✅ Local HTTPS: `https://192.168.0.16`
- ✅ All services running via PM2
- ✅ All PWA features enabled

**To enable external access**:
- ⏳ Reserve `pwa.myid.africa` in ngrok dashboard (2 minutes)
- ⏳ Start ngrok via PM2
- ✅ Access from anywhere: `https://pwa.myid.africa`

**Total time to complete**: ~2 minutes

---

## Quick Commands Reference

```bash
# After reserving domain, start ngrok
npx pm2 start ecosystem.config.cjs --only myid-ngrok
npx pm2 save

# Check status
npx pm2 status

# View ngrok logs
npx pm2 logs myid-ngrok

# Test from command line
curl https://pwa.myid.africa

# Test on iPhone
Safari → https://pwa.myid.africa
```

---

**Next**: Reserve `pwa.myid.africa` at https://dashboard.ngrok.com/domains
