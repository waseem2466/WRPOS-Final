const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

const { app } = require('electron');
const envPath = app && app.isPackaged 
    ? path.join(process.resourcesPath, '.env') 
    : path.join(__dirname, '.env');
dotenv.config({ path: envPath });

let pool;

function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }, // Common for Neon/RDS
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        // CRITICAL: Handle errors on idle clients to prevent uncaught exceptions
        pool.on('error', (err) => {
            console.error('[DB Helper] Unexpected error on idle client:', err.message);
        });
    }
    return pool;
}

/**
 * Searches for products matching the query.
 * Returns top 5 matches with name, price, and stock info.
 */
async function searchInventory(query) {
    if (!query || query.length < 2) return [];

    const p = getPool();
    try {
        // Search both main inventory and group-logged items
        const res = await p.query(
            `SELECT name, price, stock, category, 'inventory' as source
             FROM "Product" 
             WHERE name ILIKE $1 OR sku ILIKE $1
             UNION ALL
             SELECT name, price, stock, category, 'group' as source
             FROM "GroupProduct"
             WHERE name ILIKE $1
             LIMIT 5`,
            [`%${query}%`]
        );

        return res.rows.map(row => ({
            name: row.name,
            price: row.price,
            stock: row.stock,
            category: row.category || 'General',
            source: row.source
        }));
    } catch (err) {
        console.error('[DB Helper] Search Error:', err.message);
        return [];
    }
}

/**
 * Searches for a customer by phone number.
 * Returns financial info: total_loan, total_paid, balance, openclaw_limit.
 */
async function searchCustomer(phone) {
    if (!phone) return null;

    // Basic sanitization: keep only digits
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9) return null;

    const p = getPool();
    try {
        const res = await p.query(
            `SELECT id, name, phone, total_loan, total_paid, balance, openclaw_limit, openclaw_used
             FROM "Customer"
             WHERE phone LIKE $1 OR phone LIKE $2
             LIMIT 1`,
            [`%${cleanPhone}%`, `%${cleanPhone.slice(-9)}%`]
        );

        if (res.rows.length === 0) return null;

        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            phone: row.phone,
            loan: row.total_loan || 0,
            paid: row.total_paid || 0,
            balance: row.balance || 0,
            openclaw_limit: row.openclaw_limit || 0,
            openclaw_used: row.openclaw_used || 0,
            openclaw_available: (row.openclaw_limit || 0) - (row.openclaw_used || 0)
        };
    } catch (err) {
        console.error('[DB Helper] Customer Lookup Error:', err.message);
        return null;
    }
}

/**
 * Extracts phone number from text (9+ digits)
 */
function extractPhoneFromText(text) {
    const match = text.match(/\d{9,}/);
    return match ? match[0] : null;
}

/**
 * Get customer's loan details with formatted response
 */
async function getLoanDetails(customerId) {
    if (!customerId) return null;

    const p = getPool();
    try {
        const res = await p.query(
            `SELECT name, phone, total_loan, total_paid, balance, openclaw_limit, openclaw_used
             FROM "Customer"
             WHERE id = $1`,
            [customerId]
        );

        if (res.rows.length === 0) return null;
        const row = res.rows[0];

        const openclaw_available = (row.openclaw_limit || 0) - (row.openclaw_used || 0);

        return {
            name: row.name,
            phone: row.phone,
            loan: row.total_loan || 0,
            paid: row.total_paid || 0,
            balance: row.balance || 0,
            openclaw_limit: row.openclaw_limit || 0,
            openclaw_used: row.openclaw_used || 0,
            openclaw_available: openclaw_available,
            formatted: `*${row.name}* - Your Account Summary:\n\n` +
                `🏦 Loan Amount: Rs. ${row.total_loan || 0}\n` +
                `✅ Amount Paid: Rs. ${row.total_paid || 0}\n` +
                `⚠️ Outstanding Balance: Rs. ${row.balance || 0}\n\n` +
                `📊 OpenClaw Facility:\n` +
                `Limit: Rs. ${row.openclaw_limit || 0}\n` +
                `Used: Rs. ${row.openclaw_used || 0}\n` +
                `Available: Rs. ${openclaw_available}`
        };
    } catch (err) {
        console.error('[DB Helper] Loan Details Error:', err.message);
        return null;
    }
}

module.exports = { searchInventory, searchCustomer, extractPhoneFromText, getLoanDetails };
