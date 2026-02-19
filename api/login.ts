import { pool } from '../services/db';
import { errorHandler } from '../services/errorHandler';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

// User interface for type safety
interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  banned: boolean;
  banReason?: string;
  loginAttempts: number;
  lastLoginAttempt?: Date;
  lockedUntil?: Date;
}

// Database client interface
interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  release: () => void;
}

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const BCRYPT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

// Initialize database schema
async function ensureSchema(client: DbClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "AppUser" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      banned BOOLEAN DEFAULT false,
      "banReason" TEXT,
      "loginAttempts" INTEGER DEFAULT 0,
      "lastLoginAttempt" TIMESTAMP,
      "lockedUntil" TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_appuser_email ON "AppUser"(email);
  `);
}

// Seed initial admin user
async function seedAdminUser(client: DbClient, email: string, password: string) {
  errorHandler.log('Login', 'Empty database detected. Seeding initial admin user.', { email }, 'low');
  
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);
  const newId = randomUUID();
  
  await client.query(
    `INSERT INTO "AppUser" (id, name, email, password, role, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [newId, 'Admin User', email, hashedPassword, 'OWNER']
  );
  
  return await client.query(`SELECT * FROM "AppUser" WHERE email = $1 LIMIT 1`, [email]);
}

// Check if account is locked
function isAccountLocked(user: AppUser): boolean {
  if (user.lockedUntil) {
    const lockedUntil = new Date(user.lockedUntil);
    if (lockedUntil > new Date()) {
      return true;
    }
  }
  return false;
}

// Handle failed login attempt
async function handleFailedLogin(client: DbClient, userId: string) {
  const result = await client.query(
    `UPDATE "AppUser" 
     SET "loginAttempts" = "loginAttempts" + 1,
         "lastLoginAttempt" = NOW(),
         "lockedUntil" = CASE 
           WHEN "loginAttempts" + 1 >= $1 THEN NOW() + INTERVAL '15 minutes'
           ELSE "lockedUntil"
         END,
         updated_at = NOW()
     WHERE id = $2
     RETURNING "loginAttempts", "lockedUntil"`,
    [MAX_LOGIN_ATTEMPTS, userId]
  );
  
  return result.rows[0];
}

// Reset login attempts on successful login
async function resetLoginAttempts(client: DbClient, userId: string) {
  await client.query(
    `UPDATE "AppUser" 
     SET "loginAttempts" = 0,
         "lastLoginAttempt" = NOW(),
         "lockedUntil" = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}

// Generate JWT token
function generateToken(user: AppUser): string {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

// Main handler
export default async function handler(req: Request, res: Response) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted'
    });
  }

  const { email: rawEmail, password, rememberMe } = req.body;

  // Validate required fields
  if (!rawEmail || !password) {
    return res.status(400).json({ 
      error: 'Missing credentials',
      message: 'Email and password are required'
    });
  }

  // Sanitize and validate email
  const email = rawEmail.toLowerCase().trim();
  if (!isValidEmail(email)) {
    return res.status(400).json({ 
      error: 'Invalid email format',
      message: 'Please provide a valid email address'
    });
  }

  // Validate password
  if (!isValidPassword(password)) {
    return res.status(400).json({ 
      error: 'Invalid password',
      message: 'Password must be at least 6 characters'
    });
  }

  const client = await pool.connect();

  try {
    // Ensure database schema exists
    await ensureSchema(client);

    // Fetch user by email
    const userRes = await client.query(
      `SELECT * FROM "AppUser" WHERE email = $1 LIMIT 1`, 
      [email]
    );
    let user = userRes.rows[0] as AppUser | undefined;

    // Handle first-time setup (seed admin)
    if (!user) {
      const countRes = await client.query(`SELECT COUNT(*) as count FROM "AppUser"`);
      const countRow = countRes.rows[0] as { count: string } | undefined;
      const userCount = Number(countRow?.count ?? '0');
      
      if (userCount === 0) {
        const newUserRes = await seedAdminUser(client, email, password);
        const newUserRow = newUserRes.rows[0] as AppUser | undefined;
        user = newUserRow;
      } else {
        // Invalid email - but don't reveal it for security
        return res.status(401).json({ 
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }
    }

    // Safety check
    if (!user) {
      return res.status(500).json({ 
        error: 'Authentication failed',
        message: 'Unable to complete authentication'
      });
    }

    // Check if account is locked due to too many failed attempts
    if (isAccountLocked(user) && user.lockedUntil) {
      const lockedUntil = new Date(user.lockedUntil);
      const minutesRemaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      
      return res.status(403).json({ 
        error: 'Account temporarily locked',
        message: `Too many failed login attempts. Please try again in ${minutesRemaining} minute(s)`,
        lockedUntil: lockedUntil.toISOString()
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Record failed login attempt
      const attemptDataRaw = await handleFailedLogin(client, user.id);
      const attemptData = attemptDataRaw as { loginAttempts: number } | undefined;
      const remainingAttempts = MAX_LOGIN_ATTEMPTS - (attemptData?.loginAttempts ?? 0);
      
      if (remainingAttempts <= 0) {
        return res.status(403).json({ 
          error: 'Account locked',
          message: `Too many failed login attempts. Account locked for 15 minutes.` 
        });
      }
      
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
        ...(remainingAttempts <= 2 && { 
          warning: `${remainingAttempts} attempt(s) remaining before account lockout` 
        })
      });
    }

    // Check if account is banned
    if (user.banned) {
      return res.status(403).json({ 
        error: 'Account suspended',
        message: user.banReason || 'Your account has been suspended. Please contact support.',
        banReason: user.banReason
      });
    }

    // Successful login - reset login attempts
    await resetLoginAttempts(client, user.id);

    // Generate JWT token
    const tokenExpiry = rememberMe ? '30d' : JWT_EXPIRES_IN;
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: tokenExpiry as jwt.SignOptions['expiresIn'] }
    );

    // Log successful login
    errorHandler.log('Login', `User: ${user.email} (${user.role}) logged in successfully`, { email: user.email, role: user.role }, 'low');

    // Return success response
    return res.status(200).json({
      success: true,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      },
      token,
      expiresIn: tokenExpiry
    });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    errorHandler.log('Login', error, { operation: 'handler' }, 'high');

    // Don't expose internal errors to client in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return res.status(500).json({ 
      error: 'Authentication error',
      message: isDevelopment 
        ? `System error: ${error.message}` 
        : 'An error occurred during authentication. Please try again later.',
      ...(isDevelopment && { details: error.stack })
    });

  } finally {
    // Always release the database connection
    client.release();
  }
}

// Export helper functions for testing
export {
  isValidEmail,
  isValidPassword,
  isAccountLocked,
  generateToken
};
