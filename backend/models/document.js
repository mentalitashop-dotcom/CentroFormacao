const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  originalName: { type: String, trim: true, maxlength: 255 },
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, required: true, min: 1 },
  data: { type: Buffer, required: true },
  documentType: { type: String, trim: true, maxlength: 80, default: 'certificado_saude' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Document', DocumentSchema);
