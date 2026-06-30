const mongoose = require('mongoose');

const EnrolmentSchema = new mongoose.Schema({
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', required: true },
  guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'Guardian' },
  modality: { type: mongoose.Schema.Types.ObjectId, ref: 'Modality', required: true },
  ageGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'AgeGroup', required: true },
  season: { type: mongoose.Schema.Types.ObjectId, ref: 'Season', required: true },
  feeCents: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pendente', 'validada', 'recusada', 'cancelada'], default: 'pendente' },
  notes: { type: String, trim: true, maxlength: 1000 },
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  validatedAt: { type: Date }
}, { timestamps: true });

EnrolmentSchema.index({ athlete: 1, season: 1 });
EnrolmentSchema.index({ status: 1 });

module.exports = mongoose.model('Enrolment', EnrolmentSchema);
