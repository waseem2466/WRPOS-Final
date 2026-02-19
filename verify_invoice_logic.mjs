import { detectIntent } from './intent.mjs';
import { generateInvoice } from './invoice.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
const logFile = path.join(__dirname, 'verify_output.txt');

function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

async function verify() {
    log('[TEST] Starting Verification...');

    try {
        // 1. Verify Intent Detection
        log('[TEST] Checking Intent Detection...');
        const intent = detectIntent("Hello, please send me the bill");
        if (intent === 'INVOICE') {
            log('✅ Intent Detection Passed: "bill" -> INVOICE');
        } else {
            log(`❌ Intent Detection Failed: Expected INVOICE, got ${intent}`);
        }

        // 2. Verify Invoice Generation
        log('[TEST] Checking Invoice Generation...');
        const invoice = generateInvoice({ name: 'Test User', amount: 500, invoiceNumber: 'TEST-001' });
        if (invoice && invoice.includes('INVOICE') && invoice.includes('500')) {
            log('✅ Invoice Generation Passed');
        } else {
            log('❌ Invoice Generation Failed');
            log('Output: ' + invoice);
        }

    } catch (e) {
        log('❌ Module Test Failed: ' + e.message);
        log(e.stack);
    }

    // 3. Verify DB Connection
    log('[TEST] Checking DB Connection...');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const res = await pool.query('SELECT NOW()');
        log('✅ DB Connection Passed: ' + res.rows[0].now);
    } catch (e) {
        log('❌ DB Connection Failed: ' + e.message);
    } finally {
        await pool.end();
    }
}

verify();
