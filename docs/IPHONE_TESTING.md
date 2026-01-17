# Testing myID.africa PWA on iPhone

**✅ HTTPS NOW CONFIGURED - Full PWA features available!**

## HTTPS Access URLs

### Option 1: Local Network HTTPS (Recommended)
**URL**: `https://192.168.0.16`
- Uses your myid.africa SSL certificates
- Requires same Wi-Fi network

### Option 2: External HTTPS via ngrok (Works Anywhere)
**URL**: `https://unwailed-raylan-semilunar.ngrok-free.dev`
- Works from any network (cellular, other Wi-Fi)
- No configuration needed
- Free ngrok account (shows one-time interstitial page)

**Server IP Addresses:**
- Local Network: `192.168.0.16`
- ZeroTier VPN: `172.27.170.210`

---

## Quick Start - Test Right Now

### Easiest Method (Works from anywhere):

1. **Open Safari on your iPhone**
2. **Navigate to**: `https://unwailed-raylan-semilunar.ngrok-free.dev`
3. **Click "Visit Site"** on ngrok interstitial page (one-time)
4. **PWA loads with full features** ✅

### All PWA Features Now Work:
- ✅ Service Worker registration
- ✅ Add to Home Screen
- ✅ Offline mode
- ✅ Standalone app mode
- ✅ Full installation

---

## Method 1: Local Network HTTPS

### Prerequisites
- iPhone must be on the same Wi-Fi network as the server
- Server firewall is disabled (confirmed)

### Steps

1. **On your iPhone, open Safari** (Safari is required for PWA features on iOS)

2. **Navigate to:**
   ```
   http://192.168.0.16:3000
   ```

3. **Test Basic Functionality:**
   - App should load and show splash screen
   - Navigate through routes
   - Test authentication flow

### Limitations (HTTP only)
- ⚠️ **Service Worker**: Will NOT register over HTTP (requires HTTPS)
- ⚠️ **Install to Home Screen**: May not work over HTTP
- ⚠️ **Offline Mode**: Not available over HTTP
- ✅ **Basic App Features**: Will work
- ✅ **Navigation**: Will work
- ✅ **UI/UX Testing**: Will work

---

## Method 2: ZeroTier VPN Access

If your iPhone has ZeroTier installed and is on the same ZeroTier network:

1. **Install ZeroTier One** from App Store (if not already installed)

2. **Join the same ZeroTier network** as the server

3. **Navigate to:**
   ```
   http://172.27.170.210:3000
   ```

Same HTTP limitations apply.

---

## Method 3: Full PWA Testing (HTTPS Required)

To test full PWA features (service worker, install, offline mode), you need HTTPS.

### Option A: Use ngrok (Quick Setup)

On the server:

```bash
# Install ngrok (if not installed)
# Download from https://ngrok.com/download or:
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Authenticate (requires free ngrok account)
ngrok config add-authtoken YOUR_TOKEN

# Expose port 3000
ngrok http 3000
```

ngrok will provide an HTTPS URL like: `https://abc123.ngrok.io`

**On iPhone:**
- Open Safari and navigate to the ngrok HTTPS URL
- Full PWA features will work

### Option B: Self-Signed Certificate (Advanced)

For local HTTPS testing without external services:

```bash
cd /perform1/srv/work/myid-app

# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=192.168.0.16"

# Update ecosystem.config.cjs to use HTTPS
# Or run Next.js dev with HTTPS
```

**Warning**: Self-signed certificates will show security warnings on iPhone.

### Option C: Use mDNS (local .local domain)

Access via: `http://server-hostname.local:3000`

This might work for some PWA features if the browser considers `.local` as a secure context.

---

## Testing PWA Installation

### Once you have HTTPS access:

1. **Open the app in Safari**

2. **Tap the Share button** (square with arrow pointing up)

3. **Scroll down and tap "Add to Home Screen"**

4. **Tap "Add"**

5. **The app icon will appear on your home screen**

6. **Tap the icon to open the app** - it will open in standalone mode (no Safari UI)

### Verify PWA Features:

**Service Worker Registration:**
- Open Safari Developer Tools (on Mac: Safari > Develop > [Your iPhone] > Inspect)
- Check Console for: `[PWA] Service worker registered`

**Offline Mode:**
- Open the installed app
- Enable Airplane Mode
- Try navigating - cached pages should still load

**App Manifest:**
- Check that app opens in standalone mode (no browser chrome)
- Splash screen should show on startup
- Status bar should match theme color

---

## Testing Checklist

### Basic Features (Works over HTTP)
- [ ] App loads on iPhone
- [ ] Splash screen displays
- [ ] Can navigate to /auth/signin
- [ ] Can navigate to /auth/signup
- [ ] All 47 routes accessible
- [ ] UI renders correctly on iPhone screen
- [ ] Touch interactions work
- [ ] Forms are responsive

### PWA Features (Requires HTTPS)
- [ ] Service worker registers
- [ ] "Add to Home Screen" option available
- [ ] App installs to home screen
- [ ] Opens in standalone mode (no Safari UI)
- [ ] Splash screen shows on launch
- [ ] Works offline (after initial load)
- [ ] App updates when online

### iPhone-Specific Testing
- [ ] Works in Portrait mode
- [ ] Works in Landscape mode
- [ ] Status bar color correct
- [ ] Safe area insets respected (notch/home indicator)
- [ ] WebAuthn/Passkeys work (Face ID/Touch ID)
- [ ] Camera access works (QR scanner)
- [ ] Keyboard behavior correct

---

## Debugging on iPhone

### Safari Web Inspector (macOS Required)

1. **On iPhone:**
   - Settings > Safari > Advanced > Enable "Web Inspector"

2. **Connect iPhone to Mac via cable**

3. **On Mac:**
   - Safari > Develop > [Your iPhone] > [Page Name]
   - Opens Web Inspector with Console, Network, etc.

### View Console Logs:
- Check for errors
- See `[PWA]` messages
- Monitor network requests

---

## Common Issues

### "Cannot connect to server"
- Ensure iPhone is on the same Wi-Fi network
- Try: `ping 192.168.0.16` from another device on the network
- Check server is still running: `npm run pm2:status`

### "Add to Home Screen" not showing
- Requires HTTPS (except for localhost)
- Requires PWA manifest (already configured)
- Must open in Safari (not Chrome/Firefox)

### Service Worker not registering
- Only works over HTTPS (except localhost)
- Check Console for errors
- Verify production mode: app should show `[PWA] PWA support is enabled`

### App won't install
- Must use Safari browser
- Manifest must be valid
- Icons must be accessible

### Face ID/Touch ID not working
- WebAuthn requires HTTPS
- May need user permissions
- Check Console for errors

---

## Network Troubleshooting

### Find your server's IP address:
```bash
ip addr show | grep "inet "
```

### Check if server is accessible:
```bash
# From another device on the network
curl http://192.168.0.16:3000
```

### Check PM2 processes are running:
```bash
npm run pm2:status
```

### Restart services if needed:
```bash
npm run pm2:restart
```

---

## Quick Start for Basic Testing

**Simplest method to start testing right now:**

1. On your iPhone, connect to the same Wi-Fi as the server
2. Open Safari
3. Go to: `http://192.168.0.16:3000`
4. Test the app (most features will work, except service worker/offline)

**For full PWA testing:**
- Use ngrok to get HTTPS URL (see Method 3, Option A above)

---

## Current Server Status

```bash
# Check current status
cd /perform1/srv/work/myid-app
npm run pm2:status

# View logs
npm run pm2:logs

# Restart if needed
npm run pm2:restart
```

**Server is currently running:**
- PWA: http://192.168.0.16:3000
- PWA: http://172.27.170.210:3000 (ZeroTier)
- HSM Backend: http://192.168.0.16:3001
- HSM Backend: http://172.27.170.210:3001 (ZeroTier)

---

## Next Steps After Testing

1. **Collect feedback** on iPhone UI/UX
2. **Test specific features**: WebAuthn, QR scanner, forms
3. **Set up HTTPS** for production deployment
4. **Test on different iPhone models** (if available)
5. **Test on iPad** for tablet layout
6. **Performance testing** on slower network

---

## Resources

- [Apple PWA Documentation](https://developer.apple.com/documentation/webkit/progressive_web_apps)
- [iOS Safari PWA Support](https://caniuse.com/web-app-manifest)
- [PWA Best Practices for iOS](https://web.dev/progressive-web-apps/)
