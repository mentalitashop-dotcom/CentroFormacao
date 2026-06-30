const mongoose = require('mongoose');

const GuardianSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 140 },
  phone: { type: String, required: true, trim: true, maxlength: 9 },
  email: { type: String, lowercase: true, trim: true, maxlength: 180 },
  taxpayerNumber: { type: String, trim: true, maxlength: 9 },
  relationship: { type: String, trim: true, maxlength: 80 },
  addressType: { type: String, trim: true, maxlength: 40 },
  addressName: { type: String, trim: true, maxlength: 220 },
  doorNumber: { type: String, trim: true, maxlength: 20 },
  postalCode: { type: String, trim: true, maxlength: 8 },
  city: { type: String, trim: true, maxlength: 120 }
}, { timestamps: true });

GuardianSchema.index({ phone: 1 });
GuardianSchema.index({ email: 1 });

module.exports = mongoose.model('Guardian', GuardianSchema);
