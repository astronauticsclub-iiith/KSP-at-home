import express from 'express';
import Score from '../models/Score.js';

const router = express.Router();

function recomputeScore(timeSeconds, fuelUsed) {
    return Math.floor(500_000 / (timeSeconds + fuelUsed * 0.3));
}

// POST /api/scores — save only if it beats the player's existing best for this level
router.post('/', async (req, res) => {
    try {
        const { username, level, timeSeconds, fuelUsed, predictedScore } = req.body;

        if (!username || typeof username !== 'string') {
            return res.status(400).json({ error: 'username required' });
        }
        if ([level, timeSeconds, fuelUsed, predictedScore].some(v => v === undefined)) {
            return res.status(400).json({ error: 'missing fields' });
        }

        const cleanName   = username.trim().slice(0, 32);
        const lvl         = Number(level);
        const actualScore = recomputeScore(Number(timeSeconds), Number(fuelUsed));
        const verified    = actualScore === Number(predictedScore);

        // Check if the player already has a better (or equal) score for this level
        const existing = await Score.findOne({ username: cleanName, level: lvl });

        if (existing && existing.actualScore >= actualScore) {
            // Not a new personal best — return current best, don't overwrite
            return res.status(200).json({
                ok:       true,
                improved: false,
                actualScore: existing.actualScore,
                verified:    existing.verified,
            });
        }

        // New personal best — upsert (replace if exists, insert if first run)
        await Score.findOneAndReplace(
            { username: cleanName, level: lvl },
            {
                username:       cleanName,
                level:          lvl,
                timeSeconds:    Number(timeSeconds),
                fuelUsed:       Number(fuelUsed),
                predictedScore: Number(predictedScore),
                actualScore,
                verified,
                submittedAt:    new Date(),
            },
            { upsert: true }
        );

        return res.status(201).json({ ok: true, improved: true, actualScore, verified });

    } catch (err) {
        console.error('[POST /api/scores]', err.message);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// GET /api/scores?level=1 — top-10 leaderboard for a level, sorted by best score
// Because of the unique index, each player appears at most once per level.
router.get('/', async (req, res) => {
    try {
        const filter = { verified: true };
        if (req.query.level) filter.level = Number(req.query.level);

        const scores = await Score.find(filter)
            .sort({ actualScore: -1 })         // highest first
            .limit(10)
            .select('username level timeSeconds fuelUsed actualScore submittedAt -_id');

        return res.json(scores);
    } catch (err) {
        console.error('[GET /api/scores]', err.message);
        return res.status(500).json({ error: 'internal server error' });
    }
});

export default router;
