import { pool } from './db';
import { errorHandler } from './errorHandler';
import { auth as firebaseAuth, isFirebaseConfigured } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider, signInWithPopup } from "firebase/auth";



const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

export const authClient = {
  // Legacy session getter (kept for backward compat if needed, but Context handles main flow)
  getSession: async () => {
    const stored = localStorage.getItem('pos_session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e: unknown) {
        errorHandler.log('Auth', e instanceof Error ? e : new Error(String(e)), { operation: 'getSession' }, 'low');
        return null;
      }
    }
    return null;
  },

  // Centralized Authenticate Function
  // This abstracts the DB/API logic. In future, this can switch to fetch('/api/login')
  authenticate: async (email: string, password: string) => {
    try {
      // Add timeout to DB operations so login doesn't hang forever
      const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Database connection timed out. Cloud Unreachable.')), ms))
        ]);
      };

      // 1. Ensure Table Exists (Idempotent)
      await withTimeout(pool.query(`CREATE TABLE IF NOT EXISTS "AppUser" (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT, banned BOOLEAN DEFAULT FALSE, banReason TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());`), 8000);

      // 2. Check User in DB
      const userRes = await pool.query(`SELECT * FROM "AppUser" WHERE email = $1 LIMIT 1`, [email.toLowerCase().trim()]);
      let user = userRes.rows[0];

      // 3. Auto-Seed if DB is completely empty (First Run experience)
      if (!user) {
        const countRes = await pool.query(`SELECT COUNT(*) as count FROM "AppUser"`);
        if (Number(countRes.rows[0].count) === 0) {
          let hashedPassword;
          if (isElectron) {
            hashedPassword = await (window as any).electronAPI?.authHash?.(password);
          } else {
            // Fallback for Neon mode - in practice this might still hit externalization 
            // but we are focusing on Electron fix here.
            const bcrypt = await import(/* @vite-ignore */ 'bcryptjs');
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
          }

          const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7);

          await pool.query(
            `INSERT INTO "AppUser" (id, name, email, password, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [newId, 'Admin Owner', email.toLowerCase().trim(), hashedPassword, 'OWNER']
          );
          // Fetch the newly created user
          const newUserRes = await pool.query(`SELECT * FROM "AppUser" WHERE email = $1 LIMIT 1`, [email.toLowerCase().trim()]);
          user = newUserRes.rows[0];
        } else {
          throw new Error('Invalid email or password');
        }
      }

      // 4. Verify Password
      let isValid = false;
      if (isElectron) {
        isValid = await (window as any).electronAPI?.authCompare?.(password, user.password);
      } else {
        const bcrypt = await import(/* @vite-ignore */ 'bcryptjs');
        isValid = await bcrypt.compare(password, user.password);
      }

      if (isValid) {
        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          },
          token: 'session-token-' + Date.now()
        };
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (err: unknown) {
      // Mobile / Capacitor Fallback: Try REST if pool fails
      if (isCapacitor) {
        try {
          console.log('[Auth] Pool failed on mobile, attempting REST login...');
          // Define a minimal mapper for REST result
          const restRes = await (pool as any).query(`SELECT * FROM "AppUser" WHERE email = $1 LIMIT 1`, [email.toLowerCase().trim()]);
          const restUser = restRes.rows[0];

          if (restUser) {
            const bcrypt = await import(/* @vite-ignore */ 'bcryptjs');
            const valid = await bcrypt.compare(password, restUser.password);
            if (valid) {
              return {
                user: { id: restUser.id, name: restUser.name, email: restUser.email, role: restUser.role },
                token: 'rest-session-' + Date.now()
              };
            }
            throw new Error('Invalid credentials');
          }
        } catch (restErr: any) {
          console.error('[Auth] REST Fallback failed:', restErr);
        }
      }

      const error = err instanceof Error ? err : new Error(String(err));
      errorHandler.log('Auth', error, { operation: 'authenticate', email }, 'high');
      // Broadened to catch all connection / pool errors
      const msg = String(error?.message || '').toLowerCase();
      if (
        msg.includes('connection') ||
        msg.includes('network') ||
        msg.includes('failed') ||
        msg.includes('timeout') ||
        msg.includes('unreachable') ||
        msg.includes('enotfound') ||
        msg.includes('econnrefused') ||
        msg.includes('fetch') ||
        msg.includes('ssl') ||
        msg.includes('timed out')
      ) {
        throw new Error('Cloud Unreachable. Please check internet connection.');
      }
      throw error;
    }
  },

  // Firebase-specific methods
  authenticateWithFirebase: async (email: string, password: string) => {
    try {
      if (!isFirebaseConfigured || !firebaseAuth) {
        throw new Error('Cloud sign-in is not configured on this device. Use Local mode for the desktop app.');
      }
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const user = userCredential.user;

      // Optionally sync with local DB or just return the Firebase user
      return {
        user: {
          id: user.uid,
          name: user.displayName || 'Firebase User',
          email: user.email || email,
          role: 'ADMIN_GUEST' // Map real role if needed
        },
        token: await user.getIdToken()
      };
    } catch (err: any) {
      errorHandler.log('Auth-Firebase', err, { operation: 'authenticateWithFirebase', email }, 'high');
      const code = err?.code || '';
      const fallbackHint = 'Use Local mode if this account exists only in your desktop database.';

      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        throw new Error(`Cloud sign-in failed. The email/password is not valid for this Firebase project. ${fallbackHint}`);
      }

      if (code === 'auth/invalid-api-key' || code === 'auth/app-deleted') {
        throw new Error('Cloud sign-in is misconfigured. Check your Firebase API key and project settings.');
      }

      if (code === 'auth/network-request-failed') {
        throw new Error(`Cloud sign-in could not reach Firebase. ${fallbackHint}`);
      }

      throw new Error(err.message || 'Firebase Auth failed');
    }
  },

  signInWithGoogle: async () => {
    try {
      if (!isFirebaseConfigured || !firebaseAuth) {
        throw new Error('Google Sign-In is not configured on this device.');
      }
      const provider = new GoogleAuthProvider();
      // Add custom parameters if needed
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(firebaseAuth, provider);
      const user = result.user;

      return {
        user: {
          id: user.uid,
          name: user.displayName || 'Google User',
          email: user.email || '',
          role: 'USER'
        },
        token: await user.getIdToken()
      };
    } catch (err: any) {
      // Provide helpful error message for common Firebase auth issues
      let friendlyError = err.message || 'Google Sign-In failed';
      
      if (err.code === 'auth/unauthorized-domain') {
        friendlyError = 'Google Sign-In is not authorized for this domain. Please:\n1. Go to Firebase Console > Authentication > Settings\n2. Add the current domain to "Authorized domains"\n3. For development: Add "localhost:5173" and "localhost:3000"\n4. For production: Add your app domain';
      } else if (err.message?.includes('location.protocol')) {
        friendlyError = 'Firebase requires the app to run on http:// or https://. Check that localhost:3000 is properly configured.';
      }
      
      errorHandler.log('Auth-Google', err, { operation: 'signInWithGoogle', domain: window.location.hostname }, 'high');
      throw new Error(friendlyError);
    }
  },


  logout: async () => {
    try {
      if (firebaseAuth) {
        await signOut(firebaseAuth);
      }
      localStorage.removeItem('pos_session');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  },

  onAuthStateChange: (callback: (user: any) => void) => {
    if (!firebaseAuth) {
      callback(null);
      return () => undefined;
    }
    return onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        callback({
          id: user.uid,
          name: user.displayName,
          email: user.email,
          role: 'USER' // Fetch actual role from Firestore if needed
        });
      } else {
        callback(null);
      }
    });
  }
};
