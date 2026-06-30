var mongoose = require('mongoose');

const UserDataSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, maxlength: 30 },
  taxpayerNumber: { type: String, trim: true, unique: true, sparse: true, maxlength: 9 },
  birthDate: { type: Date },
  address: { type: String, trim: true, maxlength: 255 },
  addressType: { type: String, enum: ['Rua', 'Avenida', 'Praça', 'Praca', 'Largo', 'Travessa', 'Alameda', 'Estrada', 'Caminho', 'Praceta', 'Urbanização', 'Urbanizacao', 'Rotunda', 'Beco', 'Bairro', 'Quinta', 'Lugar', 'Zona Industrial'] },
  addressName: { type: String, trim: true, maxlength: 160 },
  doorNumber: { type: String, trim: true, maxlength: 12 },
  postalCode: { type: String, trim: true, maxlength: 8 },
  city: { type: String, trim: true, maxlength: 100 },
  emergencyContactName: { type: String, trim: true, maxlength: 120 },
  emergencyContactPhone: { type: String, trim: true, maxlength: 30 },
  employeeNumber: { type: String, trim: true, unique: true, sparse: true, maxlength: 6 },
  jobTitle: { type: String, trim: true, maxlength: 80 },
  athletePhotoUrl: { type: String, trim: true, maxlength: 500 },
  healthCertificateUrl: { type: String, trim: true, maxlength: 500 },
  healthCertificateName: { type: String, trim: true, maxlength: 255 },
  healthCertificateMimeType: { type: String, trim: true, maxlength: 120 },
  healthCertificateUploadedAt: { type: Date }
}, { timestamps: true });

const UserData = mongoose.model('UserData', UserDataSchema);

module.exports = UserData;
