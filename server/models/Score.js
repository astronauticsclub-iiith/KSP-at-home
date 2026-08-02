import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema({
    username:       { type: String, required: true, trim: true, maxlength: 32 },
    level:          { type: Number, required: true, min: 1, max: 10 },
    timeSeconds:    { type: Number, required: true, min: 0 },
    fuelUsed:       { type: Number, required: true, min: 0 },
    predictedScore: { type: Number, required: true }, // client-computed
    actualScore:    { type: Number },                 // server-computed independently
    verified:       { type: Boolean, default: false }, // true only if predicted === actual
    submittedAt:    { type: Date, default: Date.now },
}, { versionKey: false });

// One document per player per level — enforced at DB level
scoreSchema.index({ username: 1, level: 1 }, { unique: true });
// Fast leaderboard: top scores per level, descending
scoreSchema.index({ level: 1, actualScore: -1 });

export default mongoose.model('Score', scoreSchema);
