const mongoose = require('mongoose');

const ModalitySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500 },
  imageUrl: { type: String, trim: true, maxlength: 500 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Modality', ModalitySchema);
