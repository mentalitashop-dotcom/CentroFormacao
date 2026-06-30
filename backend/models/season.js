const mongoose = require('mongoose');

const SeasonSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Season', SeasonSchema);
