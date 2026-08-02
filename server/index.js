import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import scoresRouter from './routes/scores.js';

// In dev: loads atlas-credentials.env from project root.
// In production (Render/Docker): MONGODB_URI is set as a system env var — dotenv is a no-op.
dotenv.config({ path: './atlas-credentials.env' });

const __dirname   = dirname(fileURLToPath(import.meta.url));
const PORT        = process.env.PORT || 3001; // Render injects PORT; 3001 is local-dev fallback
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('✗  MONGODB_URI not set. Add it to atlas-credentials.env (dev) or Render env vars (prod).');
    process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());

// --------- API routes ------------------------
app.use('/api/scores', scoresRouter);

// --------- Static file serving ---------------
// In dev, Vite serves the frontend and proxies /api to this server.
// In production, this server serves the built Vite output from dist/.
if (process.env.NODE_ENV === 'production') {
    const dist = join(__dirname, '..', 'dist');
    app.use(express.static(dist));

    // Catch-all: serve index.html for any non-API path (handles client-side routing)
    app.get(/^\/(?!api).*/, (_req, res) =>
        res.sendFile(join(dist, 'index.html'))
    );
}

// -------- Database ------------------------
mongoose
    .connect(MONGODB_URI)
    .then(() => {
        console.log('✓  MongoDB Atlas connected');
        app.listen(PORT, () => console.log(`✓  Server listening on port ${PORT}`));
    })
    .catch(err => {
        console.error('✗  MongoDB connection failed:', err.message);
        process.exit(1);
    });
