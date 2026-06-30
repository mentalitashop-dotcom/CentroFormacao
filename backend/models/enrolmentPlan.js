const mongoose = require('mongoose');

const PlanImageSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true, trim: true },
  isMain: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 }
}, { _id: false });

const EnrolmentPlanSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, minlength: 13, maxlength: 13 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true },
  details: { type: Map, of: String, default: {} },
  modalityStructure: { type: mongoose.Schema.Types.ObjectId, ref: 'ModalityStructure', required: true },
  feeCents: { type: Number, required: true, min: 1 },
  vacancies: { type: Number, required: true, min: 0, default: 0 },
  images: { type: [PlanImageSchema], default: [] },
  active: { type: Boolean, default: true }
}, { timestamps: true });

EnrolmentPlanSchema.index({ name: 1 });
EnrolmentPlanSchema.index({ modalityStructure: 1 });
EnrolmentPlanSchema.index({ feeCents: 1 });

module.exports = mongoose.model('EnrolmentPlan', EnrolmentPlanSchema);
