// const { ensureSafeUTF8 } = require('./services/stringUtils'); // Removed as we can't require TS directly in Node without loader
const pg = require('pg');
const { Pool } = pg;
const dotenv = require('dotenv');
const path = require('path');

// Mock ensuring safe UTF8 if the import fails (since we are running raw JS and stringUtils is TS)
// In a real scenario we'd compile TS or use ts-node, but for quick verification we can just verify the logic locally
// or rely on the fact that we copied the function to electron-main.js.
// Let's test the logic we added to electron-main.js by copy-pasting it here for the test.
function testEnsureSafeUTF8(text) {
    if (!text) return '';
    try {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(text, 'utf-8').toString('utf-8');
        }
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
        return decoder.decode(encoder.encode(text));
    } catch (e) {
        console.error('Failed to sanitize UTF-8 string:', e);
        return '';
    }
}

console.log('--- Testing UTF-8 Sanitization ---');
const invalidBuffer = Buffer.from([0xff, 0xff, 0x61, 0x62, 0x63]); // Invalid start bytes then 'abc'
const invalidString = invalidBuffer.toString(); // This might already be sanitized by Node's toString depending on version, but let's see.
console.log('Original invalid string length:', invalidString.length);

const safeString = testEnsureSafeUTF8(invalidString);
console.log('Sanitized string:', safeString);
console.log('Sanitized string length:', safeString.length);

// Test proper emoji
const emoji = "Hello 🌍";
console.log('Emoji string:', testEnsureSafeUTF8(emoji));

console.log('\n--- Testing Database Connection ---');
dotenv.config({ path: path.join(__dirname, '.env') });
const connectionString = process.env.DATABASE_URL;
console.log('Connecting to:', connectionString);

const pool = new Pool({ connectionString });

pool.query('SELECT 1')
    .then(() => {
        console.log('✅ Database connection successful!');
        pool.end();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
        pool.end();
    });
