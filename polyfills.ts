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
    (globalThis as any).process = {
        env: {},
        version: '',
        nextTick: (cb: any) => setTimeout(cb, 0),
    };
}
