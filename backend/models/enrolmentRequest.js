const mongoose = require('mongoose');

const EnrolmentRequestItemSchema = new mongoose.Schema({
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'EnrolmentPlan' },
  planCode: { type: String, required: true, maxlength: 13 },
  planName: { type: String, required: true, maxlength: 160 },
  planImageUrl: { type: String },
  monthlyFeeCents: { type: Number, required: true, min: 1 },
  quantity: { type: Number, required: true, min: 1 },
  lineTotalCents: { type: Number, required: true, min: 1 }
}, { _id: false });

const StatusHistorySchema = new mongoose.Schema({
  changedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  oldStatus: { type: String },
  newStatus: { type: String, required: true },
  note: { type: String, maxlength: 255 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const EnrolmentRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pendente', 'validada', 'em_acompanhamento', 'concluida', 'cancelada'], default: 'pendente' },
  registrationChannel: { type: String, enum: ['secretaria'], default: 'secretaria' },
  athleteAddress: {
    addressType: String,
    addressName: String,
    doorNumber: String,
    postalCode: String,
    city: String
  },
  billing: {
    useAthleteAddress: { type: Boolean, default: false },
    taxpayerRequested: { type: Boolean, default: false },
    taxpayerNumber: { type: String, trim: true, maxlength: 9 },
    addressType: String,
    addressName: String,
    doorNumber: String,
    postalCode: String,
    city: String
  },
  items: { type: [EnrolmentRequestItemSchema], required: true },
  subtotalCents: { type: Number, required: true, min: 0 },
  totalCents: { type: Number, required: true, min: 0 },
  discountCents: { type: Number, default: 0, min: 0 },
  validatedAt: { type: Date },
  canceledAt: { type: Date },
  completedAt: { type: Date },
  statusHistory: { type: [StatusHistorySchema], default: [] }
}, { timestamps: true });

EnrolmentRequestSchema.index({ user: 1 });
EnrolmentRequestSchema.index({ status: 1 });

module.exports = mongoose.model('EnrolmentRequest', EnrolmentRequestSchema);
