# Quick iPhone Test - myID.africa PWA

## Test It Right Now (30 seconds)

### On Your iPhone:

1. Open **Safari** (must be Safari, not Chrome)

2. Go to: **`https://unwailed-raylan-semilunar.ngrok-free.dev`**

3. Click **"Visit Site"** on the ngrok page (one-time)

4. **Done!** The PWA loads with full features

---

## Install to Home Screen (2 minutes)

1. While on the site, tap the **Share** button (⬆️)

2. Scroll down, tap **"Add to Home Screen"**

3. Tap **"Add"**

4. The myID.africa icon appears on your home screen

5. Tap the icon - opens as a full app!

---

## Test Offline Mode (1 minute)

1. Open the installed app

2. Navigate to a few pages

3. Enable **Airplane Mode**

4. Navigate - pages still work!

---

## Alternative: Local Network (Same Wi-Fi)

If iPhone is on same Wi-Fi as server:

**Go to**: `https://192.168.0.16`

(May show certificate warning - safe to proceed for testing)

---

## What Works Now

✅ Service Worker
✅ Add to Home Screen
✅ Offline Mode
✅ Standalone App
✅ Full PWA Features

---

## Troubleshooting

**Can't access ngrok URL?**
- Make sure you clicked "Visit Site" on ngrok page
- Check PM2 status: `npm run pm2:status`
- Get current URL: `npx pm2 logs myid-ngrok --lines 20 | grep "started tunnel"`

**Service Worker not working?**
- Must use Safari (not Chrome/Firefox)
- Check you're on HTTPS URL
- Check browser console for errors

---

**Full docs**: See `HTTPS_SETUP_COMPLETE.md`
