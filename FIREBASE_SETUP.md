# Firebase Setup for WR POS (Electron App)

## Problem
Firebase Auth was failing with `auth/unauthorized-domain` error because Electron apps use the `file://` protocol, which Firebase doesn't support.

## Solution Implemented
The Electron app now runs on `http://localhost:3000` (production) or `http://localhost:5173` (development) instead of loading files directly. This allows Firebase to properly handle authentication.

## Required Firebase Console Configuration

### 1. Add Authorized Domains

Go to [Firebase Console](https://console.firebase.google.com/) and follow these steps:

1. **Open your project** → Select your WR POS project (`wr-web-fec66`)
2. **Navigate to** `Authentication` → `Settings` (gear icon)
3. **Find** the "Authorized domains" section
4. **Add these domains:**
   - `localhost:5173` (for development/Vite dev server)
   - `localhost:3000` (for production builds)
   - Your production domain (e.g., `wrpos.com` if deployed)
   - `127.0.0.1:3000` (alternative localhost format)
   - `127.0.0.1:5173` (alternative dev format)

### 2. Enable Web Storage (Usually Default)

In the same Authentication Settings:
- Ensure "Enable anonymous sign-in" or other auth methods you're using are **enabled**
- Check that cookies and local storage are allowed in your Electron app

## Verification Checklist

- [ ] Firebase Console shows your domains in "Authorized domains" list
- [ ] Built the app with `npm run dist`
- [ ] Installed/opened the built `.exe` file
- [ ] Google Sign-In now works without `auth/unauthorized-domain` error

## How It Works Now

### Development Mode (`npm run dev`)
- Vite dev server runs on `http://localhost:5173`
- Electron loads from `http://localhost:5173`
- Firebase sees the `http://localhost:5173` domain

### Production Mode (Built EXE)
- Express server starts on `http://localhost:3000`
- Serves the built `dist/` folder
- Electron loads from `http://localhost:3000`
- Firebase sees the `http://localhost:3000` domain

## Troubleshooting

### Still Getting "auth/unauthorized-domain"?

1. **Clear browser cache:**
   - Clear Electron app cache: Delete `%APPDATA%\WR POS\Cache`
   - Restart the app

2. **Verify domains are added:**
   - Go back to Firebase Console → Authentication → Settings
   - Copy/paste the exact domains from your browser address bar
   - Domains are case-sensitive and must match exactly

3. **Check localhost resolution:**
   - Your `hosts` file should have: `127.0.0.1 localhost`
   - On Windows, this is typically already configured

4. **Force rebuild:**
   - Delete `dist/` folder: `rmdir /s dist`
   - Run `npm run build` or `npm run dist`
   - Restart the app

### Performance Issues?

The localhost server is lightweight and shouldn't impact performance. If needed, you can:
- Adjust `SERVER_PORT` in `electron-main.cjs` (currently 3000)
- Modify cache settings in the Express server configuration

## Code Changes Made

1. **electron-main.cjs**
   - Added `startAppServer()` function to create Express server
   - Updated window loading logic to use localhost in production
   - Falls back gracefully if dev server isn't available

2. **services/auth.ts**
   - Enhanced error messages for `auth/unauthorized-domain` 
   - Now provides helpful troubleshooting steps to users

## Next Steps

1. Go to Firebase Console and add the authorized domains (see step 1 above)
2. Rebuild: `npm run build`
3. Test: `npm run dev` or build the EXE with `npm run dist`
4. Try Google Sign-In — it should work now!

---

**Questions?** Check the error message displayed in the app — it now includes step-by-step instructions for fixing Firebase issues.
