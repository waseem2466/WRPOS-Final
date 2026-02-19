// ====================== server.ts (Enhanced) ======================
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ask } from './lib/core';
import { execSync } from 'child_process';
import { errorHandler } from './lib/errorHandler';



const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ====================== MIDDLEWARE ======================

// CORS Configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  errorHandler.log('AI-Assistant', `[${timestamp}] ${req.method} ${req.path}`, { operation: 'requestLog' }, 'low');
  next();
});


// Rate Limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  
  const clientData = rateLimitMap.get(clientId);
  
  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ 
      error: 'Too many requests', 
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000) 
    });
  }
  
  clientData.count++;
  next();
};

app.use(rateLimiter);

// ====================== ROUTES ======================

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV
  });
});

// POST /ask → chat with the assistant
app.post('/ask', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { prompt, context, options } = req.body;
    
    // Validation
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid request', 
        message: 'prompt must be a non-empty string' 
      });
    }
    
    if (prompt.length > 10000) {
      return res.status(400).json({ 
        error: 'Prompt too long', 
        message: 'Maximum prompt length is 10000 characters' 
      });
    }
    
    // Call AI assistant
    const answer = await ask(prompt, context, options);
    
    const duration = Date.now() - startTime;
    
    res.json({ 
      success: true,
      answer,
      metadata: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
    
    errorHandler.log('AI-Assistant', `Ask completed in ${duration}ms`, { operation: 'ask', duration }, 'low');
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    errorHandler.log('AI-Assistant', err, { operation: 'ask', duration }, 'high');
    
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: NODE_ENV === 'development' ? err.message : 'An error occurred processing your request',
      ...(NODE_ENV === 'development' && { stack: err.stack })
    });
  }

});

// POST /ask/stream → streaming chat response
app.post('/ask/stream', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid request', 
        message: 'prompt must be a non-empty string' 
      });
    }
    
    // Set headers for SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Note: This assumes your ask function supports streaming
    // You may need to modify this based on your implementation
    const answer = await ask(prompt);
    res.write(`data: ${JSON.stringify({ content: answer, done: true })}\n\n`);
    res.end();
    
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    errorHandler.log('AI-Assistant', err, { operation: 'stream' }, 'high');
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }

});

// GET /heal → re‑run Prisma generate (self‑heal)
app.get('/heal', async (req: Request, res: Response) => {
  errorHandler.log('AI-Assistant', 'Starting Prisma regeneration...', { operation: 'heal' }, 'low');
  
  try {
    // Security: Only allow in development or with proper authentication
    if (NODE_ENV === 'production' && !req.headers.authorization) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Authentication required for heal endpoint in production' 
      });
    }
    
    // Execute Prisma generate
    const output = execSync('npx prisma generate', { 
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 30000 // 30 second timeout
    });
    
    errorHandler.log('AI-Assistant', 'Prisma regenerated successfully', { operation: 'heal' }, 'low');
    
    res.json({ 
      status: 'ok', 
      message: 'Prisma regenerated successfully',
      output: NODE_ENV === 'development' ? output : undefined
    });
    
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    errorHandler.log('AI-Assistant', err, { operation: 'heal' }, 'high');
    
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to regenerate Prisma',
      details: NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


// POST /heal/migrate → run database migrations
app.post('/heal/migrate', async (req: Request, res: Response) => {
  try {
    // Security check
    if (NODE_ENV === 'production' && !req.headers.authorization) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Authentication required' 
      });
    }
    
    errorHandler.log('AI-Assistant', 'Running database migrations...', { operation: 'migrate' }, 'low');
    
    const output = execSync('npx prisma migrate deploy', { 
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 60000 // 60 second timeout
    });
    
    errorHandler.log('AI-Assistant', 'Migrations completed', { operation: 'migrate' }, 'low');
    
    res.json({ 
      status: 'ok', 
      message: 'Database migrations completed',
      output: NODE_ENV === 'development' ? output : undefined
    });
    
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    errorHandler.log('AI-Assistant', err, { operation: 'migrate' }, 'high');
    
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to run migrations',
      details: NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


// GET /status → system status and stats
app.get('/status', async (req: Request, res: Response) => {
  try {
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      environment: NODE_ENV,
      nodeVersion: process.version
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    errorHandler.log('AI-Assistant', err, { operation: 'status' }, 'medium');
    res.status(500).json({ 
      status: 'error', 
      message: err.message 
    });
  }
});


// ====================== ERROR HANDLING ======================

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'GET /health',
      'GET /status',
      'POST /ask',
      'POST /ask/stream',
      'GET /heal',
      'POST /heal/migrate'
    ]
  });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  errorHandler.log('AI-Assistant', err, { operation: 'globalErrorHandler', path: req.path }, 'critical');
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});


// ====================== SERVER STARTUP ======================

// Graceful shutdown handler
const shutdown = (signal: string) => {
  errorHandler.log('AI-Assistant', `${signal} received. Shutting down gracefully...`, { operation: 'shutdown' }, 'low');
  
  server.close(() => {
    errorHandler.log('AI-Assistant', 'Server closed', { operation: 'shutdown' }, 'low');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    errorHandler.log('AI-Assistant', 'Forced shutdown after timeout', { operation: 'shutdown' }, 'critical');
    process.exit(1);
  }, 10000);
};


// Start server
const server = app.listen(PORT, () => {
  // Keep startup logs as console for visibility
  console.log('='.repeat(50));
  console.log('🤖 AI Assistant Server');
  console.log('='.repeat(50));
  console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
  console.log(`📦 Environment: ${NODE_ENV}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
  console.log('\nAvailable endpoints:');
  console.log(`  POST http://127.0.0.1:${PORT}/ask`);
  console.log(`  POST http://127.0.0.1:${PORT}/ask/stream`);
  console.log(`  GET  http://127.0.0.1:${PORT}/heal`);
  console.log(`  GET  http://127.0.0.1:${PORT}/status`);
  console.log(`  GET  http://127.0.0.1:${PORT}/health`);
  console.log('='.repeat(50));
  
  errorHandler.log('AI-Assistant', `Server started on port ${PORT}`, { operation: 'startup', port: PORT, env: NODE_ENV }, 'low');
});


// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  errorHandler.log('AI-Assistant', error instanceof Error ? error : new Error(String(error)), { operation: 'uncaughtException' }, 'critical');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  errorHandler.log('AI-Assistant', reason instanceof Error ? reason : new Error(String(reason)), { operation: 'unhandledRejection', promise: String(promise) }, 'critical');
  process.exit(1);
});


export default app;
