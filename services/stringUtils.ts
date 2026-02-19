/**
 * Utility functions for string manipulation and sanitization.
 */

/**
 * Ensures a string is valid UTF-8.
 * Replaces invalid characters with the replacement character ().
 * @param text The input string to sanitize.
 * @returns A guaranteed valid UTF-8 string.
 */
export function ensureSafeUTF8(text: string): string {
    if (!text) return '';
    try {
        // If we are in a Node.js environment, we can use Buffer
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(text, 'utf-8').toString('utf-8');
        }
        // Fallback for browser-like environments (though this app is Electron)
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
        return decoder.decode(encoder.encode(text));
    } catch (e) {
        console.error('Failed to sanitize UTF-8 string:', e);
        return ''; // Return empty string on catastrophic failure to avoid crashing
    }
}
