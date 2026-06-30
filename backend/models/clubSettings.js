const mongoose = require('mongoose');

const ClubSettingsSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  logoUrl: { type: String, trim: true },
  phone: { type: String, trim: true, maxlength: 9 },
  email: { type: String, lowercase: true, trim: true, maxlength: 180 },
  aboutText: { type: String, trim: true, maxlength: 1200 },
  addressType: { type: String, trim: true, maxlength: 40 },
  addressName: { type: String, trim: true, maxlength: 220 },
  address: { type: String, trim: true, maxlength: 255 },
  setupComplete: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('ClubSettings', ClubSettingsSchema);
