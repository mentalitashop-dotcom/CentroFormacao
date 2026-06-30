var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['Atleta', 'Funcionario'], default: 'Atleta', required: true},
  employeeRole: {type: String, enum: ['Admin', 'Normal'], default: 'Normal'},
  ativo: { type: Boolean, default: true },
  validado: { type: Boolean, default: true },
  dtcriacao: { type: Date, default: Date.now }
}, { timestamps: true });

// Compara a palavra-passe introduzida com a palavra-passe protegida.
UserSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
