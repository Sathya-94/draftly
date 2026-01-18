import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/error.js';
import healthRouter from './routes/health.routes.js';
import dbRouter from './routes/db.routes.js';
import authRoutes from './routes/auth.routes.js';
import emailRoutes from './routes/emails.routes.js';
import draftRoutes from './routes/drafts.routes.js';
import sendRoutes from './routes/gmailsend.routes.js';
import { requireAuth } from './middleware/auth.js';
import { nonceMiddleware } from './middleware/noncemiddleware.js';

const app = express();

app.use(helmet());
const allowedOrigin = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 60_000, max: 100 });
app.use(limiter);

app.use('/api/health', healthRouter);
app.use('/api/db', dbRouter);
app.use('/api/auth', nonceMiddleware, authRoutes);
app.use('/api/emails', requireAuth, emailRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/send', requireAuth, sendRoutes);

app.use(errorHandler);

export default app;
