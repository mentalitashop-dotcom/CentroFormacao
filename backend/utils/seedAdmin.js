const bcrypt = require('bcryptjs');
const User = require('../models/user');
const UserData = require('../models/userData');

// Garante os dados mínimos do administrador inicial.
async function ensureAdminUserData(admin) {
  const existingData = await UserData.findOne({ user: admin._id });

  if (existingData) {
    existingData.name = existingData.name || 'Administrador';
    existingData.jobTitle = existingData.jobTitle || 'Gestor do centro de formação';
    await existingData.save();
    return;
  }

  await UserData.create({ user: admin._id, name: 'Administrador', jobTitle: 'Gestor do centro de formação' });
  console.log('Dados pessoais do admin criados.');
}

// Cria a conta inicial do gestor do clube.
async function seedAdmin() {
  const username = 'admin123';
  const email = 'admin@centroformacao.pt';
  const password = 'Admin12345';

  const hashedPassword = await bcrypt.hash(password, 10);

  let admin = await User.findOne({ username });
  if (!admin) admin = await User.findOne({ role: 'Funcionario', employeeRole: 'Admin' });

  if (admin) {
    admin.username = username;
    admin.email = admin.email || email;
    admin.password = hashedPassword;
    admin.role = 'Funcionario';
    admin.employeeRole = 'Admin';
    admin.ativo = true;
    admin.validado = true;
    await admin.save();
    await ensureAdminUserData(admin);
    console.log(`Admin inicial preparado: ${username}`);
    return;
  }

  admin = await User.create({
    username,
    email,
    password: hashedPassword,
    role: 'Funcionario',
    employeeRole: 'Admin',
    ativo: true,
    validado: true
  });

  await ensureAdminUserData(admin);
  console.log(`Admin inicial criado: ${username} / ${email}`);
}

module.exports = seedAdmin;
