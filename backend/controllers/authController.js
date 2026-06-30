var User = require('../models/user');
var UserData = require('../models/userData');
var ClubSettings = require('../models/clubSettings');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var config = require('../jwtsecret/config');

// Normaliza texto sem espaços.
function normalizeNoSpaces(str) {
  return String(str || '').replace(/\s+/g, '');
}

// Normaliza o endereço de email.
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Verifica se o utilizador é conta interna.
function isInternalUser(user) {
  return user && normalizeNoSpaces(user.role) === 'Funcionario';
}

// Verifica se os dados obrigatórios da conta interna estão completos.
function isUserDataComplete(user, userData) {
  if (!userData) return false;

  if (isInternalUser(user)) {
    return !!(
      userData.name &&
      userData.phone &&
      userData.employeeNumber &&
      userData.jobTitle &&
      userData.addressType &&
      userData.addressName &&
      userData.doorNumber &&
      userData.postalCode &&
      userData.city
    );
  }

  return false;
}

// Login do gestor do clube e treinadores.
exports.login = async (req, res) => {
  const username = req.body.username || req.body.identifier;
  const { password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ message: 'Por favor, preenche todos os campos.' });
    }

    const usernameNorm = String(username).trim();
    const user = await User.findOne({
      $or: [{ username: usernameNorm }, { email: normalizeEmail(usernameNorm) }]
    });

    if (!user || user.ativo === false) {
      return res.status(401).json({ message: 'Utilizador inválido.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Password inválida.' });
    }

    if (!isInternalUser(user)) {
      return res.status(403).json({ message: 'Acesso reservado ao gestor do clube e treinadores.' });
    }

    const roleNorm = normalizeNoSpaces(user.role);
    const token = jwt.sign(
      { _id: user._id, id: user._id, role: roleNorm, username: user.username, employeeRole: user.employeeRole },
      config.secret,
      { expiresIn: '1h' }
    );

    const [userData, clubSettings] = await Promise.all([
      UserData.findOne({ user: user._id }),
      ClubSettings.findOne().lean()
    ]);

    res.json({
      token,
      user: {
        _id: user._id,
        id: user._id,
        username: user.username,
        email: user.email,
        role: roleNorm,
        employeeRole: user.employeeRole,
        validado: user.validado,
        hasUserData: isUserDataComplete(user, userData),
        clubSetupComplete: !!clubSettings?.setupComplete,
        name: userData ? userData.name : user.username
      },
      role: roleNorm
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};


// Devolve a informação da página de login.
exports.renderLoginPage = (req, res) => {
  res.json({ message: 'Login' });
};


// Termina a sessão atual do utilizador.
exports.logoutUser = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout efetuado com sucesso.' });
};

exports.logout = exports.logoutUser;

// Carrega a sessão atual.
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    const userData = await UserData.findOne({ user: req.userId });

    if (!user) {
      return res.status(404).json({ message: 'Utilizador não encontrado.' });
    }

    res.json({ user, userData });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar utilizador.' });
  }
};
