const mongoose = require('mongoose');

const ModalityStructureSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 255 },
  imageUrl: { type: String, trim: true, maxlength: 500 },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'ModalityStructure', default: null },
  active: { type: Boolean, default: true }
}, { timestamps: true });

ModalityStructureSchema.index({ name: 1, parent: 1 }, { unique: true });

module.exports = mongoose.model('ModalityStructure', ModalityStructureSchema);
