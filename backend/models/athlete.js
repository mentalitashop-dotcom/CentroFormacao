const mongoose = require('mongoose');

const AthleteSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 140 },
  birthDate: { type: Date, required: true },
  phone: { type: String, trim: true, maxlength: 9 },
  email: { type: String, lowercase: true, trim: true, maxlength: 180 },
  taxpayerNumber: { type: String, trim: true, maxlength: 9 },
  guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'Guardian' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

AthleteSchema.index({ name: 1 });
AthleteSchema.index({ guardian: 1 });

module.exports = mongoose.model('Athlete', AthleteSchema);
