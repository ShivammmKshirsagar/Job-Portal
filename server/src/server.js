import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

import jwt from 'jsonwebtoken';
import { getJwtSecret, validateJwtConfig } from './config/jwt.js';

// Enforce JWT security configuration immediately after environment loading
validateJwtConfig();

import { connectDB } from './config/db.js';
import { initSocket } from './sockets/socketHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import {
  getUploadsDir,
  ensureSampleResumesExist,
  resolveOrRecoverFile,
} from './utils/fileStorage.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import userRoutes from './routes/userRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();
const httpServer = http.createServer(app);

// Resolve allowed CORS origins independently for development and production
export const getAllowedOrigins = () => {
  const origins = [];

  // 1. Explicit ALLOWED_ORIGINS (comma-separated list)
  if (process.env.ALLOWED_ORIGINS) {
    const list = process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
    origins.push(...list);
  }

  // 2. Configured CLIENT_URL
  if (process.env.CLIENT_URL) {
    const clientUrl = process.env.CLIENT_URL.trim();
    if (clientUrl && !origins.includes(clientUrl)) {
      origins.push(clientUrl);
    }
  }

  // 3. Local Development Origins (enabled when not in strict production)
  if (process.env.NODE_ENV !== 'production') {
    const devDefaults = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://localhost:80',
      'http://localhost',
      'http://127.0.0.1',
    ];
    devDefaults.forEach((orig) => {
      if (!origins.includes(orig)) {
        origins.push(orig);
      }
    });
  }

  return origins;
};

// Origin verification helper
export const isOriginAllowed = (origin) => {
  // Allow requests with no Origin header (curl, mobile apps, same-origin, health checks)
  if (!origin) return true;
  const origins = getAllowedOrigins();
  return origins.includes(origin);
};

// Initialize Socket.IO with strict CORS
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Socket.IO CORS Error: Origin '${origin}' is not permitted.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

// Attach Socket.IO to app & init handler
initSocket(io);
app.set('io', io);

// Security & Utility Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS Error: Origin '${origin}' is not permitted by CORS policy.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});
app.use('/api/auth', authLimiter);

// Serve uploaded resumes and attachments with unified path and persistent recovery
const uploadsDir = getUploadsDir();

// Ensure demo sample assets exist on disk at boot
try {
  ensureSampleResumesExist(uploadsDir);
} catch (sampleErr) {
  console.warn('[Server] Could not initialize sample resumes:', sampleErr.message);
}

// Upload Security: Protect user-uploaded private resumes and attachments
// Public sample assets (sample_resume_*, Interview_Prep_Guide.pdf, .gitkeep) are accessible without auth.
// Candidate and employer uploaded files require valid authentication via Cookie, Bearer Token, or query token.
app.use('/uploads', async (req, res, next) => {
  const safePath = path.normalize(decodeURIComponent(req.path)).replace(/^(\.\.[\/\\])+/, '');
  const filename = path.basename(safePath);

  // Allow public sample assets and placeholders
  const isPublicSample =
    filename.startsWith('sample_resume_') ||
    filename.startsWith('Interview_Prep_') ||
    filename === '.gitkeep';

  if (!isPublicSample) {
    // Check authentication for private uploaded documents
    let token = null;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access private candidate files and attachments.',
      });
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret());
      if (!decoded || !decoded.id) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token.',
        });
      }
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token for file access.',
      });
    }
  }

  // Check if file exists on disk
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) {
    return next();
  }

  // File is missing from ephemeral container disk — attempt recovery from MongoDB / on-demand generation
  try {
    const recovered = await resolveOrRecoverFile(filename);
    if (recovered && recovered.data) {
      res.set({
        'Content-Type': recovered.contentType || 'application/pdf',
        'Content-Disposition': `inline; filename="${recovered.originalName || filename}"`,
        'Content-Length': recovered.data.length,
      });
      return res.send(recovered.data);
    }
  } catch (recoverErr) {
    console.warn('[Server] Error recovering file:', recoverErr.message);
  }

  return res.status(404).json({
    success: false,
    message: 'Requested file was not found or is unavailable.',
  });
});
app.use('/uploads', express.static(uploadsDir));

// Swagger UI Documentation
try {
  const swaggerPath = path.resolve(__dirname, 'docs/swagger.json');
  const swaggerDoc = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
  console.log('[Swagger] Interactive API docs available at /api/docs');
} catch (e) {
  console.warn('[Swagger] Could not load swagger.json:', e.message);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    application: 'CareerConnect API',
    version: '1.0.0',
    timestamp: new Date(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Fallback 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.originalUrl} not found.`,
  });
});

// Centralized error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

export const startServer = async () => {
  try {
    validateJwtConfig();
    await connectDB();
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`===============================================`);
      console.log(`CareerConnect Server is running on port ${PORT}`);
      console.log(`API URL: http://localhost:${PORT}/api`);
      console.log(`Swagger Docs: http://localhost:${PORT}/api/docs`);
      console.log(`===============================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown handling for Docker container lifecycle
const handleShutdown = async (signal) => {
  console.log(`\n[Server] ${signal} signal received. Initiating graceful shutdown...`);
  httpServer.close(async () => {
    console.log('[Server] HTTP and WebSocket connections closed.');
    try {
      const { closeDB } = await import('./config/db.js');
      await closeDB();
      console.log('[Server] MongoDB connection closed cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Error closing database connection:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[Server] Forcefully terminating after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

export { app, httpServer };
