const mongoose = require('mongoose');

const AgeGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  modality: { type: mongoose.Schema.Types.ObjectId, ref: 'Modality', required: true },
  minAge: { type: Number, min: 0, max: 100 },
  maxAge: { type: Number, min: 0, max: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

AgeGroupSchema.index({ name: 1, modality: 1 }, { unique: true });

module.exports = mongoose.model('AgeGroup', AgeGroupSchema);
