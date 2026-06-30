const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  originalName: { type: String, trim: true, maxlength: 255 },
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, required: true, min: 1 },
  data: { type: Buffer, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Image', ImageSchema);
