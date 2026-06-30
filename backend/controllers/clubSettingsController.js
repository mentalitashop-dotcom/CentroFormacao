var ClubSettings = require('../models/clubSettings');
var User = require('../models/user');

const allowedAddressStarts = ['Rua','Avenida','Praça','Praca','Largo','Travessa','Alameda','Estrada','Caminho','Praceta','Urbanização','Urbanizacao','Rotunda','Beco','Bairro','Quinta','Lugar','Zona Industrial'];

// Verifica campo.
function hasField(body, field) {
  return Object.prototype.hasOwnProperty.call(body || {}, field);
}

// Verifica se o email é válido.
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Verifica se o telefone é válido.
function isValidPhone(phone) {
  return /^[29]\d{8}$/.test(phone);
}

// Cria um email técnico a partir do nome do clube.
function buildAdminEmail(clubName) {
  const slug = String(clubName || 'clube-formacao')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'clube-formacao';

  return `admin@${slug}.pt`;
}

// Atualiza o email do admin inicial com base no nome do clube.
async function updateInitialAdminEmail(clubName) {
  const admin = await User.findOne({ username: 'admin123', role: 'Funcionario', employeeRole: 'Admin' });
  if (!admin) return;

  const email = buildAdminEmail(clubName);
  const existing = await User.findOne({ email, _id: { $ne: admin._id } });
  if (existing) return;

  admin.email = email;
  await admin.save();
}

// Obtém o início da morada.
function getAddressStart(address) {
  const value = String(address || '').trim().toLowerCase();
  return allowedAddressStarts.find((item) => value.startsWith(item.toLowerCase() + ' ') || value === item.toLowerCase()) || '';
}

// Aplica morada.
function applyAddress(settings, address) {
  const value = String(address || '').trim();
  const addressStart = getAddressStart(value);

  if (value && !addressStart) {
    return 'A morada deve começar por Rua, Avenida, Praça, Largo ou outro tipo de via válido.';
  }

  settings.addressType = addressStart || '';
  settings.addressName = addressStart ? value.slice(addressStart.length).trim() : '';
  settings.address = value;
  return '';
}

// Aplica configurações do clube.
function applyClubSettings(settings, body, options = {}) {
  const fullUpdate = options.fullUpdate === true;

  if (fullUpdate || hasField(body, 'name')) {
    const name = String(body.name || '').trim();
    if (!name) return 'O nome do clube é obrigatório.';
    settings.name = name;
  }

  if (fullUpdate || hasField(body, 'logoUrl')) {
    settings.logoUrl = body.logoUrl !== undefined ? String(body.logoUrl || '').trim() : settings.logoUrl;
  }

  if (fullUpdate || hasField(body, 'phone')) {
    const phone = String(body.phone || '').trim();
    if (phone && !isValidPhone(phone)) return 'O telefone deve ter 9 dígitos e começar por 9 ou 2.';
    settings.phone = phone;
  }

  if (fullUpdate || hasField(body, 'email')) {
    const email = String(body.email || '').trim().toLowerCase();
    if (email && !isValidEmail(email)) return 'Email inválido.';
    settings.email = email;
  }

  if (fullUpdate || hasField(body, 'aboutText')) {
    const aboutText = String(body.aboutText || '').trim();
    if (aboutText.length > 1200) return 'A história do clube não pode ultrapassar 1200 caracteres.';
    settings.aboutText = aboutText;
  }

  if (fullUpdate || hasField(body, 'address')) {
    const addressError = applyAddress(settings, body.address);
    if (addressError) return addressError;
  }

  if (body.setupComplete === true) {
    if (!settings.name || !settings.phone || !settings.email || !settings.address) {
      return 'Preenche o nome, telefone, email e morada do clube para concluir a configuração inicial.';
    }
    settings.setupComplete = true;
  }

  return '';
}

// Obtém ou cria configurações.
async function getOrCreateSettings() {
  let settings = await ClubSettings.findOne();

  if (!settings) {
    settings = new ClubSettings({
      name: 'Clube Formação',
      phone: '912345678',
      email: 'secretaria@clubeformacao.pt',
      aboutText: 'O Clube Formação facilita a inscrição de alunos em vários escalões e acompanha a evolução desportiva de cada atleta.',
      addressType: 'Rua',
      addressName: 'do Clube',
      address: 'Rua do Clube'
    });
    await settings.save();
  }

  return settings;
}

// Carrega configurações do clube.
exports.getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (error) {
    console.error('Erro ao carregar dados do clube:', error);
    res.status(500).json({ message: 'Erro ao carregar dados do clube.' });
  }
};

// Atualiza configurações do clube.
exports.updateSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const validationError = applyClubSettings(settings, req.body, { fullUpdate: true });

    if (validationError) return res.status(400).json({ message: validationError });

    await settings.save();
    if (req.body.setupComplete === true) await updateInitialAdminEmail(settings.name);
    res.json({ message: 'Dados do clube atualizados com sucesso.', settings });
  } catch (error) {
    console.error('Erro ao atualizar dados do clube:', error);
    res.status(500).json({ message: 'Erro ao atualizar dados do clube.' });
  }
};

// Atualiza parcialmente configurações do clube.
exports.patchSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const validationError = applyClubSettings(settings, req.body, { fullUpdate: false });

    if (validationError) return res.status(400).json({ message: validationError });

    await settings.save();
    if (req.body.setupComplete === true) await updateInitialAdminEmail(settings.name);
    res.json({ message: 'Campo do clube atualizado com sucesso.', settings });
  } catch (error) {
    console.error('Erro ao atualizar campo do clube:', error);
    res.status(500).json({ message: 'Erro ao atualizar campo do clube.' });
  }
};
