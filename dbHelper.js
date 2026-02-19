const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

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
        // Simple search by name or SKU
        const res = await p.query(
            `SELECT name, price, stock, category 
             FROM "Product" 
             WHERE name ILIKE $1 OR sku ILIKE $1 
             LIMIT 5`,
            [`%${query}%`]
        );

        return res.rows.map(row => ({
            name: row.name,
            price: row.price,
            stock: row.stock,
            category: row.category || 'General'
        }));
    } catch (err) {
        console.error('[DB Helper] Search Error:', err.message);
        return [];
    }
}

/**
 * Searches for a customer by phone number.
 * Returns financial info: total_loan, total_paid, balance.
 */
async function searchCustomer(phone) {
    if (!phone) return null;

    // Basic sanitization: keep only digits
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9) return null;

    const p = getPool();
    try {
        const res = await p.query(
            `SELECT name, phone, total_loan, total_paid, balance 
             FROM "Customer" 
             WHERE phone LIKE $1 OR phone LIKE $2
             LIMIT 1`,
            [`%${cleanPhone}%`, `%${cleanPhone.slice(-9)}%`]
        );

        if (res.rows.length === 0) return null;

        const row = res.rows[0];
        return {
            name: row.name,
            phone: row.phone,
            loan: row.total_loan || 0,
            paid: row.total_paid || 0,
            balance: row.balance || 0
        };
    } catch (err) {
        console.error('[DB Helper] Customer Lookup Error:', err.message);
        return null;
    }
}

module.exports = { searchInventory, searchCustomer };
