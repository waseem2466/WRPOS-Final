// Polyfill for Buffer - must be at the very top before any other code
import { Buffer } from 'buffer';
import * as util from 'util';

(window as any).util = util;

// Polyfill global
if (typeof global === 'undefined') {
    (globalThis as any).global = globalThis;
}

// Polyfill Buffer - assign to both globalThis and window for compatibility
(globalThis as any).Buffer = Buffer;
if (typeof window !== 'undefined') {
    (window as any).Buffer = Buffer;
}

// Polyfill process if it doesn't exist (minimal)
if (typeof (globalThis as any).process === 'undefined') {
    (globalThis as any).process = { env: {} };
}
if (!(globalThis as any).process.env) {
    (globalThis as any).process.env = {};
}

// Force BETTER_AUTH_URL for Electron file:// compatibility
// This ensures that any BetterAuth client initialized without a baseURL will fallback to this valid HTTPS URL
(globalThis as any).process.env.BETTER_AUTH_URL = 'https://ep-muddy-bush-aeihyvce.neonauth.c-2.us-east-2.aws.neon.tech/neondb/auth';
(globalThis as any).process.env.NODE_ENV = (globalThis as any).process.env.NODE_ENV || 'production';

if (typeof (globalThis as any).process.nextTick === 'undefined') {
    (globalThis as any).process.nextTick = (cb: any) => setTimeout(cb, 0);
}
